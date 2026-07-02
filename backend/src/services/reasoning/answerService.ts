import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import { classifyQuestion, RoutedQuestion } from "../retrieval/intentRouter";
import {
  countPasal,
  listPasal,
  fetchPasal,
  pickAyat,
  PasalRecord,
} from "../retrieval/documentStructure";
import { hybridRetrieval } from "../retrieval/hybridRetrieval";
import { reason, ReasoningResult } from "./reasoningService";
import { getSession } from "../../config/neo4j";
import type { RetrievalTrace } from "../retrieval/retrievalTrace";
import { buildStructuralJourney } from "../retrieval/documentJourney";

const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

export type AnswerMode = "raw" | "natural";

export interface AnswerInput {
  question: string;
  documentId?: string;
  history?: { role: string; content: string }[];
  answerMode?: AnswerMode;
  allowStructural: boolean; // true only for /query
  trace: Partial<RetrievalTrace>;
}

export interface AnswerOutput {
  answer: string;
  confidence: number;
  confidence_level: "green" | "yellow" | "red";
  citations: ReasoningResult["citations"];
  contextCount: number;
}

interface StructuralData {
  count: number;
  list: { pasal_number: number; title: string }[];
  pasal: PasalRecord | null;
}

export function formatStructuralAnswer(
  routed: RoutedQuestion,
  data: StructuralData,
  mode: AnswerMode,
): string {
  if (routed.kind === "structural_count") {
    const titles = data.list
      .map((p) => `Pasal ${p.pasal_number} — ${p.title}`)
      .join("\n");
    return mode === "raw"
      ? `Jumlah pasal: ${data.count}\n${titles}`
      : `Kontrak ini memiliki ${data.count} pasal:\n${titles}`;
  }
  if (routed.kind === "structural_list") {
    const titles = data.list
      .map((p) => `Pasal ${p.pasal_number} — ${p.title}`)
      .join("\n");
    return mode === "raw" ? titles : `Daftar pasal dalam kontrak:\n${titles}`;
  }
  // fetch
  if (!data.pasal) return `Pasal ${routed.pasalNumber} tidak ditemukan dalam dokumen.`;
  if (routed.ayatNumber != null) {
    const text = pickAyat(JSON.stringify(data.pasal.ayat), routed.ayatNumber);
    if (!text)
      return `Pasal ${routed.pasalNumber} ayat ${routed.ayatNumber} tidak ditemukan.`;
    return `Pasal ${data.pasal.pasal_number} ayat ${routed.ayatNumber}: ${text}`;
  }
  return `Pasal ${data.pasal.pasal_number} — ${data.pasal.title}\n${data.pasal.content}`;
}

async function fetchDocumentText(documentId: string): Promise<string | null> {
  const session = await getSession();
  try {
    const r = await session.run(
      `MATCH (d:Document { id: $documentId }) RETURN d.raw_text AS t LIMIT 1`,
      { documentId },
    );
    return (r.records[0]?.get("t") as string) ?? null;
  } catch {
    return null;
  } finally {
    await session.close();
  }
}

async function phraseNaturally(question: string, factText: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL,
      systemInstruction:
        "Anda CLARA. Sampaikan ulang fakta berikut dalam Bahasa Indonesia yang jelas dan ringkas. Jangan menambah fakta di luar yang diberikan.",
      generationConfig: { temperature: 0.2 },
    });
    const res = await model.generateContent(
      `FAKTA:\n${factText}\n\nPERTANYAAN: ${question}`,
    );
    return res.response.text().trim() || factText;
  } catch {
    return factText;
  }
}

export async function answerQuestion(input: AnswerInput): Promise<AnswerOutput> {
  const { question, documentId, history = [], trace } = input;
  const answerMode: AnswerMode = input.answerMode ?? env.DEFAULT_ANSWER_MODE;
  const routed = classifyQuestion(question, !!documentId);

  // ── Structural path (chat only) ──────────────────────────────────────────
  if (input.allowStructural && documentId && routed.kind !== "reasoning") {
    const data: StructuralData = { count: 0, list: [], pasal: null };
    if (routed.kind === "structural_count") {
      data.count = await countPasal(documentId);
      data.list = await listPasal(documentId);
    } else if (routed.kind === "structural_list") {
      data.list = await listPasal(documentId);
    } else if (routed.kind === "structural_fetch") {
      data.pasal = await fetchPasal(documentId, routed.pasalNumber!);
    }

    const facts = formatStructuralAnswer(routed, data, "raw");
    const answer =
      answerMode === "natural" ? await phraseNaturally(question, facts) : facts;

    const matched = data.pasal
      ? [{ pasal_number: data.pasal.pasal_number, title: data.pasal.title }]
      : data.list;

    trace.mode = "structural";
    trace.answerMode = answerMode;
    trace.contextSource = "document_structure";
    trace.structural = {
      kind: routed.kind.replace("structural_", "") as "count" | "fetch" | "list",
      pasalNumber: routed.pasalNumber,
      ayatNumber: routed.ayatNumber,
      matched,
      source: "Struktur Dokumen",
    };
    // Honest confidence even for deterministic lookups: a "not found" must not read green.
    const found =
      routed.kind === "structural_fetch" ? data.pasal !== null : data.list.length > 0;
    const score = found ? 0.99 : 0.4;
    const level: "green" | "yellow" | "red" = found ? "green" : "yellow";

    // The journey is a trace/explainability aid — never let its failure break a valid answer.
    try {
      trace.journey = await buildStructuralJourney({
        documentId,
        routed,
        question,
        matched,
        found,
        answerMode,
      });
    } catch (e) {
      console.warn("[answerService] journey build failed:", (e as Error).message);
    }

    // Deterministic facts → grounded by construction; natural mode still surfaces a confidence read.
    trace.reasoning =
      answerMode === "natural"
        ? {
            paths: [],
            agreement: 1,
            groundedness: found ? 1 : 0.5,
            unsupportedClaims: [],
            gated: false,
            confidence: score,
            confidenceLevel: level,
          }
        : undefined;

    return {
      answer,
      confidence: score,
      confidence_level: level,
      citations: [],
      contextCount: data.list.length || (data.pasal ? 1 : 0),
    };
  }

  // ── Reasoning path ───────────────────────────────────────────────────────
  trace.mode = "hybrid";
  const context = await hybridRetrieval(question, documentId, 8, trace);

  const extraHistory = [...history];
  let groundingText = context.map((r) => `${r.title}\n${r.content}`).join("\n\n");

  if (documentId) {
    const rawText = await fetchDocumentText(documentId);
    if (rawText) {
      const fits = rawText.length / 4 <= env.DOC_INJECT_TOKEN_BUDGET;
      if (fits) {
        extraHistory.unshift({
          role: "user",
          content: `DOKUMEN YANG DIUNGGAH (document_id: ${documentId}):\n\n${rawText}\n\n---\nGunakan isi dokumen di atas untuk menjawab.`,
        });
        groundingText = `${rawText}\n\n${groundingText}`;
        trace.contextSource = "raw_text";
      } else {
        trace.contextSource = "retrieval"; // too long → rely on per-document retrieval already in context
      }
    } else {
      trace.contextSource = context.length > 0 ? "retrieval" : "none";
    }
  } else {
    trace.contextSource = context.length > 0 ? "retrieval" : "none";
  }

  const reasoning = await reason(question, context, extraHistory, trace, groundingText);
  return {
    answer: reasoning.answer,
    confidence: reasoning.confidence,
    confidence_level: reasoning.confidence_level,
    citations: reasoning.citations,
    contextCount: context.length,
  };
}

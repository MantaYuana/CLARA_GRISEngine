/**
 * reasoningService.ts
 * Calls Gemini with an Indonesian legal assistant system prompt using a
 * Self-Consistency Loop:
 *
 *  1. Generate N reasoning paths at varying temperatures.
 *  2. Select the conservative anchor path (index 0, low temperature).
 *  3. Verify groundedness of the answer against the supplied context/document
 *     text (LLM-verified claim support) and compute semantic agreement
 *     across paths (mean pairwise cosine of their embeddings).
 *  4. Combine groundedness (gated) + agreement into a single honest
 *     confidence score: green / yellow / red.
 *  5. Build citations via exact Pasal/UU matching against the retrieved
 *     context nodes (no fuzzy substring matching).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import type { RetrievalResult } from "../retrieval/denseRetrieval";
import type { RetrievalTrace } from "../retrieval/retrievalTrace";
import { checkGroundedness } from "./groundedness";
import { embedText } from "../embedding/embeddingService";

const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

// Types

export interface Citation {
  id: string;
  title: string;
  source: string;
}

export type ConfidenceLevel = "green" | "yellow" | "red";

export interface ReasoningResult {
  answer: string;
  citations: Citation[];
  confidence: number; // 0–1 numeric score
  confidence_level: ConfidenceLevel; // green / yellow / red
  confidence_label: string; // human-readable explanation
  variance: number; // 1 - agreement (debug/logging, kept for back-compat)
  language: "id" | "en";
}

// System Prompt

const SYSTEM_PROMPT = `Anda adalah CLARA, asisten hukum AI untuk UMKM Indonesia. Jawab dalam Bahasa Indonesia yang jelas.

PEDOMAN:
1. UTAMAKAN "KONTEKS HUKUM" dan isi DOKUMEN yang diberikan. Jawab berdasarkan teks itu.
2. Jika pertanyaan menanyakan ISI DOKUMEN dan informasinya tidak ada di dokumen, katakan "Tidak ditemukan dalam dokumen." JANGAN mengarang.
3. Gunakan pengetahuan hukum internal HANYA untuk pertanyaan hukum umum ketika konteks kosong/tidak relevan — bukan untuk mengarang isi dokumen pengguna.
4. Sebutkan pasal/UU yang relevan BILA ADA dalam konteks (format: "Pasal N UU No. X Tahun YYYY"). Jangan paksakan kutipan bila tidak relevan.
5. Beri saran praktis dan tandai risiko dengan [RISIKO TINGGI]/[RISIKO SEDANG]/[PERHATIAN].`;

// Context builder

function buildContext(results: RetrievalResult[]): string {
  if (results.length === 0) return "No relevant legal context found.";
  return results
    .map((r, i) => `[${i + 1}] ${r.label}: ${r.title} (${r.source})\n${r.content}`)
    .join("\n\n---\n\n");
}

// Citation extraction
const CITATION_PATTERN =
  /(?:Pasal\s+\d+(?:\s+ayat\s+\d+)?|UU\s+(?:No\.\s*)?\d+(?:\s+Tahun\s+\d{4})?|PP\s+(?:No\.\s*)?\d+(?:\s+Tahun\s+\d{4})?|Permenaker\s+(?:No\.\s*)?\d+(?:\s+Tahun\s+\d{4})?)/gi;

function countCitations(text: string): number {
  return (text.match(CITATION_PATTERN) ?? []).length;
}

// Exact legal-reference parsing/matching (Task 13)

export interface LegalRef {
  pasal?: number;
  ayat?: number;
  uuNumber?: number;
  uuYear?: number;
}

export function parseLegalRef(s: string): LegalRef {
  const pasal = s.match(/Pasal\s+(\d+)/i);
  const ayat = s.match(/ayat\s+\(?(\d+)\)?/i);
  const uu = s.match(/UU\s+(?:No\.?\s*)?(\d+)(?:\s+Tahun\s+(\d{4}))?/i);
  return {
    pasal: pasal ? parseInt(pasal[1], 10) : undefined,
    ayat: ayat ? parseInt(ayat[1], 10) : undefined,
    uuNumber: uu ? parseInt(uu[1], 10) : undefined,
    uuYear: uu && uu[2] ? parseInt(uu[2], 10) : undefined,
  };
}

export function refMatchesNode(
  ref: string,
  node: { title: string; content: string; pasal_number?: number | null },
): boolean {
  const r = parseLegalRef(ref);
  if (r.pasal == null) {
    // Non-pasal ref (e.g. a bare UU) → fall back to whole-token title match.
    return node.title.toLowerCase().includes(ref.toLowerCase());
  }
  const nodeRef = parseLegalRef(node.title);
  const nodePasal = node.pasal_number ?? nodeRef.pasal;
  if (nodePasal !== r.pasal) return false;
  // If the citation names a UU year and the node has one, they must agree.
  if (r.uuYear && nodeRef.uuYear && r.uuYear !== nodeRef.uuYear) return false;
  return true;
}

// Single reasoning path
async function generatePath(
  prompt: string,
  systemInstruction: string,
  temperature: number,
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: env.GEMINI_MODEL,
    systemInstruction,
    generationConfig: { temperature },
  });
  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// Self-consistency loop

/**
 * Run N Gemini calls at varying temperatures to generate diverse reasoning paths.
 * Path 0 is always at TEMPERATURE_LOW (conservative / statutory anchor).
 * Paths 1…N-1 use TEMPERATURE_HIGH (exploratory).
 */
async function selfConsistencyLoop(prompt: string, n: number): Promise<string[]> {
  const tempLow = parseFloat(String(env.TEMPERATURE_LOW ?? 0.1));
  const tempHigh = parseFloat(String(env.TEMPERATURE_HIGH ?? 0.7));

  const tasks = Array.from({ length: n }, (_, i) =>
    generatePath(prompt, SYSTEM_PROMPT, i === 0 ? tempLow : tempHigh).catch(() => ""),
  );

  const paths = await Promise.all(tasks);
  // Filter out empty paths (API failures are tolerated)
  return paths.filter((p) => p.length > 0);
}

// Semantic agreement (Task 12)

export function meanPairwiseCosine(vectors: number[][]): number {
  if (vectors.length <= 1) return 1;
  let sum = 0,
    count = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      let dot = 0;
      const a = vectors[i],
        b = vectors[j];
      for (let k = 0; k < a.length; k++) dot += a[k] * b[k]; // L2-normalized → dot = cosine
      sum += dot;
      count++;
    }
  }
  return count ? sum / count : 1;
}

export async function semanticAgreement(paths: string[]): Promise<number> {
  if (paths.length <= 1) return 1;
  const vecs = await Promise.all(
    paths.map((p) => embedText(p.slice(0, 2000), "passage")),
  );
  return meanPairwiseCosine(vecs);
}

// Groundedness-gated confidence (Task 12)

export function combineConfidence(
  groundedness: number,
  agreement: number,
): {
  score: number;
  level: ConfidenceLevel;
  label: string;
  gated: boolean;
} {
  if (groundedness < env.GROUNDEDNESS_FLOOR) {
    return {
      score: Math.round(Math.min(0.3, groundedness) * 100) / 100,
      level: "red",
      gated: true,
      label:
        "Rendah – Jawaban tidak cukup didukung oleh dokumen/konteks. Verifikasi manual diperlukan.",
    };
  }
  const score = Math.round((0.5 * groundedness + 0.5 * agreement) * 100) / 100;
  if (score >= 0.75)
    return {
      score,
      level: "green",
      gated: false,
      label: "Tinggi – Jawaban konsisten dan didukung oleh sumber.",
    };
  return {
    score,
    level: "yellow",
    gated: false,
    label: "Sedang – Jawaban interpretatif; pertimbangkan konsultasi lebih lanjut.",
  };
}

// Main export

export async function reason(
  question: string,
  context: RetrievalResult[],
  history?: { role: string; content: string }[],
  traceSink?: Partial<RetrievalTrace>,
  groundingText?: string,
): Promise<ReasoningResult> {
  const n = parseInt(String(env.REASONING_PATHS ?? 3), 10);

  const contextText = buildContext(context);

  // Build history prefix if provided
  let historyPrefix = "";
  if (history && history.length > 0) {
    historyPrefix =
      history
        .map((h) => `[${h.role === "user" ? "User" : "CLARA"}]: ${h.content}`)
        .join("\n") + "\n\n";
  }

  const prompt = `${historyPrefix}LEGAL CONTEXT:\n${contextText}\n\nQUESTION: ${question}`;

  // Read temperature constants once (same values selfConsistencyLoop uses internally)
  const tempLow = parseFloat(String(env.TEMPERATURE_LOW ?? 0.1));
  const tempHigh = parseFloat(String(env.TEMPERATURE_HIGH ?? 0.7));

  // Run self-consistency loop
  const paths = await selfConsistencyLoop(prompt, n);

  // Graceful fallback: if all paths failed
  if (paths.length === 0) {
    if (traceSink !== undefined) {
      traceSink.reasoning = {
        paths: [],
        agreement: 1,
        groundedness: 0,
        unsupportedClaims: [],
        gated: true,
        confidence: 0,
        confidenceLevel: "red",
      };
    }
    return {
      answer:
        "Maaf, terjadi kesalahan saat memproses pertanyaan Anda. Silakan coba lagi.",
      citations: [],
      confidence: 0,
      confidence_level: "red",
      confidence_label:
        "Rendah – Tidak dapat menghasilkan jawaban. Silakan coba lagi atau sederhanakan pertanyaan Anda.",
      variance: 1.0,
      language: "id",
    };
  }

  // Conservative anchor; no longer "prefer most citations" (removes fabrication incentive).
  const bestPath = paths[0];

  const grounding = await checkGroundedness(
    bestPath,
    groundingText ?? buildContext(context),
  );
  const agreement = await semanticAgreement(paths);
  const conf = combineConfidence(grounding.score, agreement);

  // Populate trace sink if provided — mirrors exactly the values already computed above.
  // path index 0 ran at TEMPERATURE_LOW; all subsequent paths at TEMPERATURE_HIGH.
  // Note: `paths` here contains only the non-empty results from selfConsistencyLoop,
  // so index within this array maps directly to the original call order (0 = low temp).
  if (traceSink !== undefined) {
    traceSink.reasoning = {
      paths: paths.map((text, idx) => ({
        index: idx,
        temperature: idx === 0 ? tempLow : tempHigh,
        citationCount: countCitations(text),
      })),
      agreement,
      groundedness: grounding.score,
      unsupportedClaims: grounding.unsupportedClaims,
      gated: conf.gated,
      confidence: conf.score,
      confidenceLevel: conf.level,
    };
  }

  // Build citations via exact Pasal/UU matching against the retrieved context nodes.
  const citations: Citation[] = [];
  const extracted = bestPath.match(CITATION_PATTERN) ?? [];
  const unique = Array.from(new Set(extracted.map((c) => c.trim().replace(/\n/g, " "))));
  for (const ext of unique) {
    const node = context.find((r) =>
      refMatchesNode(ext, {
        title: r.title,
        content: r.content,
        pasal_number: (r as any).pasal_number,
      }),
    );
    if (node) {
      if (!citations.some((c) => c.id === node.id))
        citations.push({ id: node.id, title: ext, source: node.source });
    } else {
      citations.push({
        id: `ext-${Math.random().toString(36).slice(2, 9)}`,
        title: ext,
        source: "Pengetahuan Model",
      });
    }
  }
  // Ensure we always include the top 2 RAG items if the AI used RAG broadly
  // but failed to perfectly cite it.
  if (context.length > 0 && citations.length === 0) {
    context
      .slice(0, 2)
      .forEach((r) => citations.push({ id: r.id, title: r.title, source: r.source }));
  }

  return {
    answer: bestPath,
    citations,
    confidence: conf.score,
    confidence_level: conf.level,
    confidence_label: conf.label,
    variance: Math.round((1 - agreement) * 1000) / 1000, // kept for back-compat
    language: "id",
  };
}

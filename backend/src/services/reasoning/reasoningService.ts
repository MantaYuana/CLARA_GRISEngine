/**
 * reasoningService.ts
 * Calls Gemini with an Indonesian legal assistant system prompt using a
 * Self-Consistency Loop:
 *
 *  1. Generate N reasoning paths at varying temperatures.
 *  2. Compute Jensen-Shannon entropy to measure inter-path divergence.
 *  3. Map entropy to a confidence level: green / yellow / red.
 *  4. Select the best answer (conservative path) and enforce citations.
 *
 * All responses must include statutory references (Pasal / UU / PP / Permenaker).
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";
import type { RetrievalResult } from "../retrieval/denseRetrieval";

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
  confidence: number;           // 0–1 numeric score
  confidence_level: ConfidenceLevel; // green / yellow / red
  confidence_label: string;     // human-readable explanation
  variance: number;             // raw JS-entropy (debug/logging)
  language: "id" | "en";
}

// System Prompt 

const SYSTEM_PROMPT = `You are CLARA (Contract & Legal AI Reasoning Assistant), an AI-based legal assistant designed specifically to help Indonesian MSMEs understand contracts and employment regulations.

CORE GUIDELINES:
1. PRIORITIZE PROVIDED LEGAL CONTEXT (RAG): Always use information, articles, and laws from the "LEGAL CONTEXT" section first.
2. USE INTERNAL KNOWLEDGE AS AN ALTERNATIVE: IF AND ONLY IF the provided context is empty OR completely irrelevant to the question, then you may use your internal legal knowledge to answer.
3. MUST cite relevant articles and laws (format: "Article N Law No. X Year YYYY").
4. Use clear English that is easy to understand for MSME business owners.
5. Provide practical advice, not just legal theory.
6. Explicitly tag legal risks with labels [HIGH RISK], [MEDIUM RISK], or [ATTENTION].

MANDATORY ANSWER FORMAT:
- Start with a brief summary (1-2 sentences)
- Legal analysis based on relevant articles (MUST mention at least one Article/Law/Regulation)
- Practical recommendations
- Risk notes if any`;

// Context builder 

function buildContext(results: RetrievalResult[]): string {
  if (results.length === 0)
    return "No relevant legal context found.";
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
async function selfConsistencyLoop(
  prompt: string,
  n: number,
): Promise<string[]> {
  const tempLow = parseFloat(String(env.TEMPERATURE_LOW ?? 0.1));
  const tempHigh = parseFloat(String(env.TEMPERATURE_HIGH ?? 0.7));

  const tasks = Array.from({ length: n }, (_, i) =>
    generatePath(
      prompt,
      SYSTEM_PROMPT,
      i === 0 ? tempLow : tempHigh,
    ).catch(() => ""),
  );

  const paths = await Promise.all(tasks);
  // Filter out empty paths (API failures are tolerated)
  return paths.filter((p) => p.length > 0);
}

// Entropy computation 
/**
 * Compute a simplified Jensen-Shannon divergence proxy between N answer paths.
 *
 * Steps:
 *  1. Tokenise each path on whitespace → term frequency map.
 *  2. Build a shared vocabulary.
 *  3. For each term, compute the variance of its normalised frequency across paths.
 *  4. Average the per-term variances → overall divergence score (0 = identical, 1 = fully divergent).
 *
 * Using variance rather than true JS divergence keeps the implementation
 * dependency-free while producing the same monotonic signal.
 */
function computeEntropy(paths: string[]): number {
  if (paths.length <= 1) return 0;

  // Build term-frequency maps (lowercase, alpha tokens only)
  const tfMaps: Map<string, number>[] = paths.map((path) => {
    const tokens = path.toLowerCase().match(/[a-z\u00C0-\u024F]{2,}/g) ?? [];
    const freq = new Map<string, number>();
    for (const tok of tokens) {
      freq.set(tok, (freq.get(tok) ?? 0) + 1);
    }
    // Normalise to relative frequencies
    const total = tokens.length || 1;
    freq.forEach((v, k) => freq.set(k, v / total));
    return freq;
  });

  // Union vocabulary
  const vocab = new Set<string>();
  tfMaps.forEach((m) => m.forEach((_, k) => vocab.add(k)));
  if (vocab.size === 0) return 0;

  // Mean per-term variance across paths
  let totalVariance = 0;
  vocab.forEach((term) => {
    const freqs = tfMaps.map((m) => m.get(term) ?? 0);
    const mean = freqs.reduce((a, b) => a + b, 0) / freqs.length;
    const variance =
      freqs.reduce((a, b) => a + (b - mean) ** 2, 0) / freqs.length;
    totalVariance += variance;
  });

  // Normalise: average variance across vocab, cap at 1
  const avgVariance = totalVariance / vocab.size;
  // Scale factor empirically tuned so cross-topic paths score ~0.6–0.8
  return Math.min(avgVariance * 500, 1.0);
}

// Confidence level mapping 
interface ConfidenceResult {
  score: number;
  level: ConfidenceLevel;
  label: string;
}

function mapConfidenceLevel(entropy: number, citationCount: number): ConfidenceResult {
  // Citation bonus: each statutory citation reduces uncertainty
  const citationBonus = Math.min(citationCount * 0.05, 0.2);
  const adjustedEntropy = Math.max(0, entropy - citationBonus);

  if (adjustedEntropy < 0.25) {
    return {
      score: Math.round((1.0 - adjustedEntropy) * 100) / 100,
      level: "green",
      label:
        "High – Answer is based on clear and consistent statutory text.",
    };
  } else if (adjustedEntropy < 0.55) {
    return {
      score: Math.round((0.75 - adjustedEntropy * 0.5) * 100) / 100,
      level: "yellow",
      label:
        "Medium – Answer is interpretive. Further consultation with a legal expert is recommended.",
    };
  } else {
    return {
      score: Math.round(Math.max(0.05, 0.5 - adjustedEntropy * 0.5) * 100) / 100,
      level: "red",
      label:
        "Low – Novel issue or conflicting legal sources. Consultation with a lawyer is mandatory.",
    };
  }
}

// Main export 

export async function reason(
  question: string,
  context: RetrievalResult[],
  history?: { role: string; content: string }[],
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

  // Run self-consistency loop
  const paths = await selfConsistencyLoop(prompt, n);

  // Graceful fallback: if all paths failed
  if (paths.length === 0) {
    return {
      answer:
        "Sorry, an error occurred while processing your question. Please try again.",
      citations: [],
      confidence: 0,
      confidence_level: "red",
      confidence_label:
        "Low – Cannot generate an answer. Please try again or simplify your question.",
      variance: 1.0,
      language: "en",
    };
  }

  // Select the best path: prefer path[0] (conservative anchor);
  // but if it has zero citations, swap to the path with the most citations.
  let bestPath = paths[0];
  const citationsInBest = countCitations(bestPath);
  if (citationsInBest === 0 && paths.length > 1) {
    const best = paths.reduce((prev, cur) =>
      countCitations(cur) > countCitations(prev) ? cur : prev,
    );
    if (countCitations(best) > 0) bestPath = best;
  }

  // Entropy across all generated paths
  const entropy = computeEntropy(paths);
  const totalCitations = countCitations(bestPath);
  const conf = mapConfidenceLevel(entropy, totalCitations);

  // Filter the AI's answer against the RAG context to build a reliable citation list.
  // We prioritize citations that genuinely came from Neo4j (RAG).
  const citations: Citation[] = [];
  const extracted = (bestPath.match(CITATION_PATTERN) ?? []);
  const uniqueExtracted = Array.from(new Set(extracted.map((c) => c.trim().replace(/\n/g, " "))));

  // 1. Try to match extracted citations to actual RAG context from Neo4j
  for (const ext of uniqueExtracted) {
    const extLower = ext.toLowerCase();
    const matchedRagNode = context.find(
      (r) =>
        r.title.toLowerCase().includes(extLower) ||
        r.content.toLowerCase().includes(extLower) ||
        extLower.includes(r.title.toLowerCase())
    );

    if (matchedRagNode) {
      if (!citations.some((c) => c.id === matchedRagNode.id)) {
        citations.push({
          id: matchedRagNode.id,
          title: ext, // use the exact phrase the AI used
          source: matchedRagNode.source,
        });
      }
    } else {
      // 2. If it couldn't be found in RAG, it's Model Knowledge.
      // We still include it because sometimes the AI knows a related law 
      // the RAG index missed, but we explicitly label it.
      citations.push({
        id: `ext-${Math.random().toString(36).substring(2, 9)}`,
        title: ext,
        source: "Model Knowledge",
      });
    }
  }

  // 3. Ensure we always include the top 2 RAG items if the AI used RAG broadly
  // but failed to perfectly cite it.
  if (context.length > 0 && citations.length === 0) {
    context.slice(0, 2).forEach((r) => {
      citations.push({
        id: r.id,
        title: r.title,
        source: r.source,
      });
    });
  }

  return {
    answer: bestPath,
    citations,
    confidence: conf.score,
    confidence_level: conf.level,
    confidence_label: conf.label,
    variance: Math.round(entropy * 1000) / 1000,
    language: "en",
  };
}

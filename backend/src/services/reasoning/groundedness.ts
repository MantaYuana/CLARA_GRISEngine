import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../../config/env";

const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

export interface ClaimVerdict {
  claim: string;
  supported: boolean;
}
export interface GroundednessResult {
  score: number; // supported / total
  supported: number;
  total: number;
  unsupportedClaims: string[];
}

export function scoreFromClaims(claims: ClaimVerdict[]): GroundednessResult {
  if (claims.length === 0)
    return { score: 1, supported: 0, total: 0, unsupportedClaims: [] };
  const supported = claims.filter((c) => c.supported).length;
  return {
    score: supported / claims.length,
    supported,
    total: claims.length,
    unsupportedClaims: claims.filter((c) => !c.supported).map((c) => c.claim),
  };
}

/**
 * Verify an answer against its source text. Returns a neutral 0.5 on any failure
 * (so a broken verifier neither falsely greens nor falsely reds a real answer).
 */
export async function checkGroundedness(
  answer: string,
  sourceText: string,
): Promise<GroundednessResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
    });
    const prompt =
      `Anda adalah pemeriksa fakta. Pecah JAWABAN menjadi klaim-klaim faktual atomik. ` +
      `Untuk setiap klaim, tentukan apakah klaim tersebut DIDUKUNG secara langsung oleh SUMBER. ` +
      `Balas HANYA JSON: {"claims":[{"claim":"...","supported":true|false}]}.\n\n` +
      `SUMBER:\n${sourceText.slice(0, 12000)}\n\nJAWABAN:\n${answer.slice(0, 4000)}`;
    const res = await model.generateContent(prompt);
    const parsed = JSON.parse(res.response.text()) as { claims: ClaimVerdict[] };
    return scoreFromClaims(parsed.claims ?? []);
  } catch (e) {
    console.warn(
      "[groundedness] verifier failed; defaulting to 0.5:",
      (e as Error).message,
    );
    return { score: 0.5, supported: 0, total: 0, unsupportedClaims: [] };
  }
}

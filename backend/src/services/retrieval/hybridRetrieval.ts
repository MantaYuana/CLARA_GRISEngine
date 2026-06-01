/**
 * hybridRetrieval.ts
 * Merges dense vector + BM25 full-text + symbolic Cypher results using
 * Reciprocal Rank Fusion (RRF) with configurable per-leg weights.
 * Optionally blends contract clause results when a document_id is provided.
 */
import { denseSearch } from "./denseRetrieval";
import { bm25Search } from "./bm25Retrieval";
import { contractRetrieval } from "./contractRetrieval";
import { symbolicSearch } from "./symbolicRetrieval";
import type { RetrievalResult } from "./denseRetrieval";
import { env } from "../../config/env";

const RRF_K = 60; // standard RRF constant

function rrfScore(rank: number): number {
  return 1 / (RRF_K + rank + 1);
}

/**
 * Merge ranked lists using Reciprocal Rank Fusion.
 * @param lists   Array of result lists (each ordered best-first)
 * @param weights Per-list weight multiplier
 */
function mergeByRRF(
  lists: RetrievalResult[][],
  weights: number[] = [],
): RetrievalResult[] {
  const scoreMap = new Map<string, { result: RetrievalResult; rrf: number }>();

  lists.forEach((list, listIdx) => {
    const w = weights[listIdx] ?? 1.0;
    list.forEach((item, rankIdx) => {
      const key = item.id;
      const contribution = rrfScore(rankIdx) * w;
      if (scoreMap.has(key)) {
        scoreMap.get(key)!.rrf += contribution;
      } else {
        scoreMap.set(key, { result: { ...item }, rrf: contribution });
      }
    });
  });

  return [...scoreMap.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .map(({ result, rrf }) => ({ ...result, score: rrf }));
}

/**
 * Hybrid retrieval combining dense + BM25 + symbolic graph traversal.
 *
 * Weights are pulled from `.env` so they can be tuned without a code change:
 *   HYBRID_DENSE_WEIGHT    (default 0.5)
 *   HYBRID_BM25_WEIGHT     (default 0.3)
 *   HYBRID_SYMBOLIC_WEIGHT (default 0.2)
 *
 * If documentId is provided, also searches uploaded contract clauses —
 * those results are boosted (weight 1.5) to surface near the top.
 */
export async function hybridRetrieval(
  query: string,
  documentId?: string,
  topK = 8,
): Promise<RetrievalResult[]> {
  const denseWeight = parseFloat(String(env.HYBRID_DENSE_WEIGHT ?? 0.5));
  const bm25Weight = parseFloat(String(env.HYBRID_BM25_WEIGHT ?? 0.3));
  const symbolicWeight = parseFloat(String(env.HYBRID_SYMBOLIC_WEIGHT ?? 0.2));

  // Run all retrieval legs in parallel
  const [denseResults, bm25Results, symbolicResults] = await Promise.all([
    denseSearch(query, topK).catch(() => [] as RetrievalResult[]),
    bm25Search(query, topK).catch(() => [] as RetrievalResult[]),
    symbolicSearch(query, topK).catch(() => [] as RetrievalResult[]),
  ]);

  let contractResults: RetrievalResult[] = [];
  if (documentId) {
    contractResults = await contractRetrieval(query, documentId, topK).catch(
      () => [] as RetrievalResult[],
    );
  }

  const lists: RetrievalResult[][] = [denseResults, bm25Results, symbolicResults];
  const weights: number[] = [denseWeight, bm25Weight, symbolicWeight];

  if (contractResults.length > 0) {
    lists.push(contractResults);
    weights.push(1.5); // boost contract clause relevance
  }

  const merged = mergeByRRF(lists, weights);
  return merged.slice(0, topK);
}

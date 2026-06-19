/**
 * hybridRetrieval.ts
 * Merges dense vector + BM25 full-text + symbolic Cypher results using
 * Reciprocal Rank Fusion (RRF) with configurable per-leg weights.
 * Optionally blends contract clause results when a document_id is provided.
 *
 * Pass a `Partial<RetrievalTrace>` as the optional `traceSink` to capture
 * the full per-leg + fusion breakdown for the Retrieval Trace Visualization.
 * The return value and all existing behaviour are unchanged when it is omitted.
 */
import { denseSearch } from "./denseRetrieval";
import { bm25Search } from "./bm25Retrieval";
import { contractRetrieval } from "./contractRetrieval";
import { symbolicSearch } from "./symbolicRetrieval";
import type { RetrievalResult } from "./denseRetrieval";
import type {
  LegName,
  RetrievalTrace,
  TraceFusion,
  TraceFusionContribution,
  TraceFusionItem,
  TraceLeg,
  TraceGraph,
} from "./retrievalTrace";
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
 * Build TraceLeg[], TraceFusion, and TraceGraph from the leg inputs and
 * the final merged list, then mutate `sink` with the result.
 *
 * This is a pure, synchronous helper — all values are derived from the
 * same data used by mergeByRRF so the trace is always consistent with
 * the returned results.
 */
function populateTraceSink(
  sink: Partial<RetrievalTrace>,
  legNames: LegName[],
  lists: RetrievalResult[][],
  weights: number[],
  merged: RetrievalResult[],
): void {
  // ── legs ──────────────────────────────────────────────────────────────────
  const legs: TraceLeg[] = legNames.map((name, i) => ({
    name,
    weight: weights[i] ?? 1.0,
    items: lists[i].map((r, rankIdx) => ({
      id: r.id,
      title: r.title,
      source: r.source,
      score: r.score,
      rank: rankIdx, // 0-based: best = 0
    })),
  }));
  sink.legs = legs;

  // ── fusion ─────────────────────────────────────────────────────────────────
  // Build a lookup: id → { legName, rank } for every leg that contained it
  const legPresence = new Map<string, { leg: LegName; rank: number; weight: number }[]>();
  lists.forEach((list, i) => {
    list.forEach((item, rankIdx) => {
      if (!legPresence.has(item.id)) legPresence.set(item.id, []);
      legPresence.get(item.id)!.push({ leg: legNames[i], rank: rankIdx, weight: weights[i] ?? 1.0 });
    });
  });

  const fusionItems: TraceFusionItem[] = merged.map((item, finalRank) => {
    const presence = legPresence.get(item.id) ?? [];
    const contributions: TraceFusionContribution[] = presence.map(({ leg, rank, weight }) => ({
      leg,
      rank,
      weighted: rrfScore(rank) * weight, // (1 / (RRF_K + rank + 1)) * legWeight
    }));
    const total = contributions.reduce((sum, c) => sum + c.weighted, 0);
    return { id: item.id, title: item.title, contributions, total, finalRank };
  });

  const fusion: TraceFusion = { rrfK: RRF_K, items: fusionItems };
  sink.fusion = fusion;

  // ── graph ──────────────────────────────────────────────────────────────────
  // Build a quick set of all ids found per leg for the foundBy mapping
  const foundByMap = new Map<string, LegName[]>();
  lists.forEach((list, i) => {
    list.forEach((item) => {
      if (!foundByMap.has(item.id)) foundByMap.set(item.id, []);
      foundByMap.get(item.id)!.push(legNames[i]);
    });
  });

  // RRF total per item: reuse the fusion items we already computed
  const rrfTotalById = new Map<string, number>(fusionItems.map((fi) => [fi.id, fi.total]));

  const graph: TraceGraph = {
    nodes: merged.map((r) => ({
      id: r.id,
      label: r.label,
      title: r.title,
      source: r.source,
      foundBy: foundByMap.get(r.id) ?? [],
      fusedScore: rrfTotalById.get(r.id) ?? 0,
    })),
    edges: [], // filled later by fetchSubgraphEdges
  };
  sink.graph = graph;
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
 *
 * If traceSink is provided, it is mutated in-place with `legs`, `fusion`,
 * and `graph` fields. The returned array is identical whether or not a
 * sink is passed (non-breaking addition).
 */
export async function hybridRetrieval(
  query: string,
  documentId?: string,
  topK = 8,
  traceSink?: Partial<RetrievalTrace>,
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
  const legNames: LegName[] = ["dense", "bm25", "symbolic"];

  if (contractResults.length > 0) {
    lists.push(contractResults);
    weights.push(1.5); // boost contract clause relevance
    legNames.push("contract");
  }

  const merged = mergeByRRF(lists, weights);
  const result = merged.slice(0, topK);

  // Populate the trace sink if the caller requested it (non-breaking side-effect)
  if (traceSink !== undefined) {
    populateTraceSink(traceSink, legNames, lists, weights, result);
  }

  return result;
}

/**
 * retrievalTrace.ts
 * Shared data contract for the Retrieval Trace Visualization feature.
 *
 * A `RetrievalTrace` captures everything that happens between a user's question
 * and the Gemini call: per-leg retrieval scores, RRF fusion math, the knowledge
 * graph subgraph that was touched, and the self-consistency / confidence math.
 *
 * Producers fill a `Partial<RetrievalTrace>` passed in as an optional sink:
 *   - hybridRetrieval()  → fills `legs`, `fusion`
 *   - fetchSubgraphEdges → contributes to `graph`
 *   - reason()           → fills `reasoning`
 * Routes assemble the pieces and attach the trace to the API response.
 */

export type LegName = "dense" | "bm25" | "symbolic" | "contract";

/** One retrieved item within a single retrieval leg, with its raw score + rank. */
export interface TraceLegItem {
  id: string;
  title: string;
  source: string;
  score: number; // leg-native score (dense: cosine 0–1, bm25: normalized, symbolic: fixed)
  rank: number; // 0-based rank within this leg (best = 0)
}

/** A single retrieval leg's contribution. */
export interface TraceLeg {
  name: LegName;
  weight: number;
  items: TraceLegItem[];
}

/** Per-leg RRF contribution for one fused item. */
export interface TraceFusionContribution {
  leg: LegName;
  rank: number; // rank of this item within that leg
  weighted: number; // (1 / (rrfK + rank + 1)) * legWeight
}

/** One item after Reciprocal Rank Fusion. */
export interface TraceFusionItem {
  id: string;
  title: string;
  contributions: TraceFusionContribution[];
  total: number; // sum of weighted contributions
  finalRank: number; // 0-based rank in the merged list
}

export interface TraceFusion {
  rrfK: number; // the RRF constant (60)
  items: TraceFusionItem[];
}

/** A node in the knowledge-graph subgraph view. */
export interface TraceGraphNode {
  id: string;
  label: string; // Neo4j label: Article | LegalConcept | ContractClause | ...
  title: string;
  source: string;
  foundBy: LegName[]; // which legs surfaced this node
  fusedScore: number; // its RRF total
}

/** A real Neo4j relationship between two retrieved nodes. */
export interface TraceGraphEdge {
  from: string;
  to: string;
  type: string; // relationship type, e.g. PART_OF, REQUIRES, RELATED_TO, CITES
}

export interface TraceGraph {
  nodes: TraceGraphNode[];
  edges: TraceGraphEdge[];
}

/** One self-consistency reasoning path's metadata (no answer text). */
export interface TraceReasoningPath {
  index: number;
  temperature: number;
  citationCount: number;
}

export interface TraceReasoning {
  paths: TraceReasoningPath[];
  agreement: number; // mean pairwise cosine of path embeddings, 0–1
  groundedness: number; // fraction of answer claims supported by sources, 0–1
  unsupportedClaims: string[]; // claims the verifier could not support
  gated: boolean; // true when groundedness < floor forced RED
  confidence: number; // 0–1 final score
  confidenceLevel: "green" | "yellow" | "red";
}

export type TraceMode = "hybrid" | "structural";
export type StructuralKind = "count" | "fetch" | "list";

/** Structural (deterministic) answer trace — no legs / RRF / embeddings. */
export interface TraceStructural {
  kind: StructuralKind;
  pasalNumber?: number;
  ayatNumber?: number;
  matched: { pasal_number: number; title: string }[];
  source: string; // e.g. "Struktur Dokumen"
}

export interface RetrievalTrace {
  query: string;
  mode: TraceMode; // discriminator the drawer branches on
  answerMode?: "raw" | "natural";
  legs: TraceLeg[];
  fusion: TraceFusion;
  graph: TraceGraph;
  structural?: TraceStructural;
  reasoning?: TraceReasoning; // absent for structural "raw" answers
  contextSource: "retrieval" | "raw_text" | "none" | "document_structure";
}

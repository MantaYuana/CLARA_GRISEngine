/**
 * retrievalTrace.test.ts
 * Tests for the Retrieval Trace Visualization feature.
 *
 * Covers:
 *  1. hybridRetrieval with a traceSink populates `legs` with correct 0-based ranks.
 *  2. traceSink `fusion` total equals sum of contributions[].weighted.
 *  3. traceSink `fusion` items are ordered ascending by total (finalRank 0 = highest total).
 *  4. fetchSubgraphEdges([]) returns [] without hitting the DB.
 *
 * All Neo4j / embedding calls are mocked — no live database required.
 */
import { hybridRetrieval } from "./hybridRetrieval";
import { fetchSubgraphEdges } from "./graphContext";
import * as denseModule from "./denseRetrieval";
import * as bm25Module from "./bm25Retrieval";
import * as contractModule from "./contractRetrieval";
import * as symbolicModule from "./symbolicRetrieval";
import * as neo4jConfig from "../../config/neo4j";
import type { RetrievalResult } from "./denseRetrieval";
import type { RetrievalTrace } from "./retrievalTrace";

// ── helpers ────────────────────────────────────────────────────────────────

const makeResult = (
  id: string,
  score: number,
  label: RetrievalResult["label"] = "Article",
): RetrievalResult => ({
  id,
  label,
  title: `Title ${id}`,
  content: `Content for ${id}`,
  score,
  source: "Test",
});

// ── module mocks ───────────────────────────────────────────────────────────

jest.mock("./denseRetrieval");
jest.mock("./bm25Retrieval");
jest.mock("./contractRetrieval");
jest.mock("./symbolicRetrieval");
jest.mock("../embedding/embeddingService", () => ({
  embedText: jest.fn().mockResolvedValue(new Array(768).fill(0.1)),
}));

// Mock neo4j getSession used by fetchSubgraphEdges
jest.mock("../../config/neo4j", () => ({
  getSession: jest.fn(),
  getDriver: jest.fn(),
}));

// ── typed mock refs ────────────────────────────────────────────────────────

const mockDense = denseModule.denseSearch as jest.MockedFunction<typeof denseModule.denseSearch>;
const mockBm25 = bm25Module.bm25Search as jest.MockedFunction<typeof bm25Module.bm25Search>;
const mockContract = contractModule.contractRetrieval as jest.MockedFunction<typeof contractModule.contractRetrieval>;
const mockSymbolic = symbolicModule.symbolicSearch as jest.MockedFunction<typeof symbolicModule.symbolicSearch>;
const mockGetSession = neo4jConfig.getSession as jest.MockedFunction<typeof neo4jConfig.getSession>;

// ── RRF math constant (must mirror hybridRetrieval.ts) ─────────────────────

const RRF_K = 60;
function rrfScore(rank: number, weight: number): number {
  return (1 / (RRF_K + rank + 1)) * weight;
}

// ══════════════════════════════════════════════════════════════════════════════
// Suite 1: traceSink — legs
// ══════════════════════════════════════════════════════════════════════════════

describe("hybridRetrieval with traceSink — legs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // dense: [a1 (rank 0), a2 (rank 1)]
    mockDense.mockResolvedValue([makeResult("a1", 0.9), makeResult("a2", 0.7)]);
    // bm25: [a2 (rank 0), a3 (rank 1)]
    mockBm25.mockResolvedValue([makeResult("a2", 0.8), makeResult("a3", 0.6)]);
    mockSymbolic.mockResolvedValue([]);
    mockContract.mockResolvedValue([]);
  });

  test("populates traceSink.legs with one entry per active leg", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    expect(sink.legs).toBeDefined();
    // symbolic ran but returned [] — it should still be listed
    expect(sink.legs!.length).toBe(3); // dense, bm25, symbolic
    const legNames = sink.legs!.map((l) => l.name);
    expect(legNames).toContain("dense");
    expect(legNames).toContain("bm25");
    expect(legNames).toContain("symbolic");
  });

  test("leg items have 0-based ranks in the correct order", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    const denseLeg = sink.legs!.find((l) => l.name === "dense")!;
    expect(denseLeg.items[0].id).toBe("a1");
    expect(denseLeg.items[0].rank).toBe(0);
    expect(denseLeg.items[1].id).toBe("a2");
    expect(denseLeg.items[1].rank).toBe(1);

    const bm25Leg = sink.legs!.find((l) => l.name === "bm25")!;
    expect(bm25Leg.items[0].id).toBe("a2");
    expect(bm25Leg.items[0].rank).toBe(0);
    expect(bm25Leg.items[1].id).toBe("a3");
    expect(bm25Leg.items[1].rank).toBe(1);
  });

  test("leg weight matches the env-configured value (default 0.5 for dense)", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    const denseLeg = sink.legs!.find((l) => l.name === "dense")!;
    expect(denseLeg.weight).toBe(0.5);
  });

  test("contract leg is included when documentId is provided and returns results", async () => {
    mockContract.mockResolvedValue([makeResult("cc1", 0.95, "ContractClause")]);
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", "doc-123", 8, sink);

    const legNames = sink.legs!.map((l) => l.name);
    expect(legNames).toContain("contract");
    const contractLeg = sink.legs!.find((l) => l.name === "contract")!;
    expect(contractLeg.weight).toBe(1.5);
  });

  test("calling without traceSink returns results identically (non-breaking)", async () => {
    const withSink: Partial<RetrievalTrace> = {};
    const [resultsNoSink, resultsWithSink] = await Promise.all([
      hybridRetrieval("test query"),
      hybridRetrieval("test query", undefined, 8, withSink),
    ]);
    // Refresh mocks are cleared between calls; re-stub for the second call:
    // (Both calls run with the same beforeEach stubs — order is fine here since
    //  Promise.all fires them in the same tick before either resolves.)
    expect(resultsNoSink.map((r) => r.id)).toEqual(resultsWithSink.map((r) => r.id));
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 2: traceSink — fusion math
// ══════════════════════════════════════════════════════════════════════════════

describe("hybridRetrieval with traceSink — fusion math", () => {
  // Fixed scenario:
  //   dense (weight 0.5): [a1 @ rank 0, a2 @ rank 1]
  //   bm25  (weight 0.3): [a2 @ rank 0, a3 @ rank 1]
  //   symbolic (weight 0.2): []
  //
  // Expected RRF totals (with RRF_K = 60):
  //   a1: rrfScore(0, 0.5) = 0.5/61
  //   a2: rrfScore(1, 0.5) + rrfScore(0, 0.3) = 0.5/62 + 0.3/61
  //   a3: rrfScore(1, 0.3) = 0.3/62
  //   Rank order: a2 > a1 > a3

  beforeEach(() => {
    jest.clearAllMocks();
    mockDense.mockResolvedValue([makeResult("a1", 0.9), makeResult("a2", 0.7)]);
    mockBm25.mockResolvedValue([makeResult("a2", 0.8), makeResult("a3", 0.6)]);
    mockSymbolic.mockResolvedValue([]);
    mockContract.mockResolvedValue([]);
  });

  test("fusion.rrfK equals 60", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);
    expect(sink.fusion!.rrfK).toBe(60);
  });

  test("each fusion item's total equals sum of contributions[].weighted", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    for (const item of sink.fusion!.items) {
      const sumContribs = item.contributions.reduce((s, c) => s + c.weighted, 0);
      expect(item.total).toBeCloseTo(sumContribs, 10);
    }
  });

  test("fusion items are ordered so finalRank 0 has the highest total", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    const items = sink.fusion!.items;
    // finalRank must be ascending and match index
    items.forEach((item, idx) => {
      expect(item.finalRank).toBe(idx);
    });
    // total must be non-increasing (best first)
    for (let i = 0; i < items.length - 1; i++) {
      expect(items[i].total).toBeGreaterThanOrEqual(items[i + 1].total);
    }
  });

  test("a2 appears first because it contributes from both dense and bm25", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    expect(sink.fusion!.items[0].id).toBe("a2");
    expect(sink.fusion!.items[0].contributions.length).toBe(2);

    const legNames = sink.fusion!.items[0].contributions.map((c) => c.leg);
    expect(legNames).toContain("dense");
    expect(legNames).toContain("bm25");
  });

  test("contribution weighted values match RRF formula exactly", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    // a1 is only in dense at rank 0, weight 0.5
    const a1 = sink.fusion!.items.find((i) => i.id === "a1")!;
    expect(a1.contributions).toHaveLength(1);
    expect(a1.contributions[0].leg).toBe("dense");
    expect(a1.contributions[0].rank).toBe(0);
    expect(a1.contributions[0].weighted).toBeCloseTo(rrfScore(0, 0.5), 10);

    // a2 is in dense at rank 1 and bm25 at rank 0
    const a2 = sink.fusion!.items.find((i) => i.id === "a2")!;
    const denseContrib = a2.contributions.find((c) => c.leg === "dense")!;
    const bm25Contrib = a2.contributions.find((c) => c.leg === "bm25")!;
    expect(denseContrib.weighted).toBeCloseTo(rrfScore(1, 0.5), 10);
    expect(bm25Contrib.weighted).toBeCloseTo(rrfScore(0, 0.3), 10);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 3: traceSink — graph nodes
// ══════════════════════════════════════════════════════════════════════════════

describe("hybridRetrieval with traceSink — graph", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDense.mockResolvedValue([makeResult("a1", 0.9), makeResult("a2", 0.7)]);
    mockBm25.mockResolvedValue([makeResult("a2", 0.8), makeResult("a3", 0.6)]);
    mockSymbolic.mockResolvedValue([]);
    mockContract.mockResolvedValue([]);
  });

  test("graph.edges is initially empty (filled later by fetchSubgraphEdges)", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);
    expect(sink.graph!.edges).toEqual([]);
  });

  test("graph.nodes contain all items in the merged result", async () => {
    const sink: Partial<RetrievalTrace> = {};
    const results = await hybridRetrieval("test query", undefined, 8, sink);

    const nodeIds = sink.graph!.nodes.map((n) => n.id);
    results.forEach((r) => expect(nodeIds).toContain(r.id));
    expect(sink.graph!.nodes.length).toBe(results.length);
  });

  test("node foundBy correctly lists which legs surfaced each item", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    const a2Node = sink.graph!.nodes.find((n) => n.id === "a2")!;
    expect(a2Node.foundBy).toContain("dense");
    expect(a2Node.foundBy).toContain("bm25");

    const a1Node = sink.graph!.nodes.find((n) => n.id === "a1")!;
    expect(a1Node.foundBy).toEqual(["dense"]);

    const a3Node = sink.graph!.nodes.find((n) => n.id === "a3")!;
    expect(a3Node.foundBy).toEqual(["bm25"]);
  });

  test("node fusedScore matches the fusion item total", async () => {
    const sink: Partial<RetrievalTrace> = {};
    await hybridRetrieval("test query", undefined, 8, sink);

    for (const node of sink.graph!.nodes) {
      const fusionItem = sink.fusion!.items.find((fi) => fi.id === node.id)!;
      expect(node.fusedScore).toBeCloseTo(fusionItem.total, 10);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Suite 4: fetchSubgraphEdges
// ══════════════════════════════════════════════════════════════════════════════

describe("fetchSubgraphEdges", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns [] immediately with no DB call when nodeIds is empty", async () => {
    const result = await fetchSubgraphEdges([]);
    expect(result).toEqual([]);
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  test("queries Neo4j and maps rows to TraceGraphEdge when nodeIds is non-empty", async () => {
    const mockClose = jest.fn().mockResolvedValue(undefined);
    const mockRun = jest.fn().mockResolvedValue({
      records: [
        {
          get: (field: string) => {
            const row: Record<string, string | null> = {
              from: "a1", to: "a2", type: "CITES",
              fromNumber: null, toNumber: null,
              fromName: null, toName: null,
              fromTitle: null, toTitle: null,
            };
            return row[field] ?? null;
          },
        },
        {
          get: (field: string) => {
            const row: Record<string, string | null> = {
              from: "a2", to: "a3", type: "PART_OF",
              fromNumber: "Pasal 59", toNumber: null,
              fromName: null, toName: null,
              fromTitle: null, toTitle: "Undang-Undang No. 13 Tahun 2003",
            };
            return row[field] ?? null;
          },
        },
      ],
    });
    mockGetSession.mockResolvedValue({ run: mockRun, close: mockClose } as any);

    const edges = await fetchSubgraphEdges(["a1", "a2", "a3"]);

    expect(mockRun).toHaveBeenCalledTimes(1);
    const [cypher, params] = mockRun.mock.calls[0];
    expect(cypher).toContain("WHERE a.id IN $ids AND b.id IN $ids");
    expect(params.ids).toEqual(["a1", "a2", "a3"]);

    expect(edges).toHaveLength(2);
    // CITES: default case – no labels on either node → context undefined
    expect(edges[0]).toEqual({ from: "a1", to: "a2", type: "CITES", context: undefined });
    // PART_OF: to has title "Undang-Undang No. 13 Tahun 2003" → context uses title fallback
    expect(edges[1]).toEqual({ from: "a2", to: "a3", type: "PART_OF", context: "Undang-Undang No. 13 Tahun 2003" });
    expect(mockClose).toHaveBeenCalled();
  });

  test("returns [] and closes session on DB error (graceful degradation)", async () => {
    const mockClose = jest.fn().mockResolvedValue(undefined);
    const mockRun = jest.fn().mockRejectedValue(new Error("Neo4j unavailable"));
    mockGetSession.mockResolvedValue({ run: mockRun, close: mockClose } as any);

    const edges = await fetchSubgraphEdges(["a1", "a2"]);

    expect(edges).toEqual([]);
    expect(mockClose).toHaveBeenCalled(); // finally block must always close
  });
});

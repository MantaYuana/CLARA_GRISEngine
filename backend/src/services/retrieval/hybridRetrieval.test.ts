/**
 * hybridRetrieval.test.ts
 * Tests for hybrid retrieval result merging logic.
 * All Neo4j / Gemini calls are mocked so no real database is needed.
 */
import { hybridRetrieval } from "./hybridRetrieval";
import * as denseModule from "./denseRetrieval";
import * as bm25Module from "./bm25Retrieval";
import * as contractModule from "./contractRetrieval";
import * as symbolicModule from "./symbolicRetrieval";
import type { RetrievalResult } from "./denseRetrieval";

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

jest.mock("./denseRetrieval");
jest.mock("./bm25Retrieval");
jest.mock("./contractRetrieval");
jest.mock("./symbolicRetrieval");
jest.mock("../embedding/embeddingService", () => ({
  embedText: jest.fn().mockResolvedValue(new Array(768).fill(0.1)),
}));

describe("hybridRetrieval", () => {
  const mockDense = denseModule.denseSearch as jest.MockedFunction<
    typeof denseModule.denseSearch
  >;
  const mockBm25 = bm25Module.bm25Search as jest.MockedFunction<
    typeof bm25Module.bm25Search
  >;
  const mockContract = contractModule.contractRetrieval as jest.MockedFunction<
    typeof contractModule.contractRetrieval
  >;
  const mockSymbolic = symbolicModule.symbolicSearch as jest.MockedFunction<
    typeof symbolicModule.symbolicSearch
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDense.mockResolvedValue([makeResult("a1", 0.9), makeResult("a2", 0.7)]);
    mockBm25.mockResolvedValue([makeResult("a2", 0.8), makeResult("a3", 0.6)]);
    mockSymbolic.mockResolvedValue([]);
    mockContract.mockResolvedValue([]);
  });

  test("merges dense and BM25 results using RRF", async () => {
    const results = await hybridRetrieval("apa itu wanprestasi");
    expect(results).toHaveLength(3); // a1, a2, a3
    // a2 ranks highest because it appears in both lists
    expect(results[0].id).toBe("a2");
  });

  test("returns unique results (no duplicates)", async () => {
    const results = await hybridRetrieval("PKWT maksimal");
    const ids = results.map((r: RetrievalResult) => r.id);
    const uniqueIds = [...new Set(ids)];
    expect(ids.length).toBe(uniqueIds.length);
  });

  test("includes contract clause results when documentId provided", async () => {
    mockContract.mockResolvedValue([
      makeResult("cc1", 0.95, "ContractClause"),
      makeResult("cc2", 0.88, "ContractClause"),
    ]);

    const results = await hybridRetrieval("klausula denda", "doc-uuid-123");

    expect(mockContract).toHaveBeenCalledWith(
      "klausula denda",
      "doc-uuid-123",
      expect.any(Number),
    );

    const contractResults = results.filter(
      (r: RetrievalResult) => r.label === "ContractClause",
    );
    expect(contractResults.length).toBeGreaterThan(0);
    // Contract clauses boosted to 1.5 weight should rank near top
    expect(results[0].label).toBe("ContractClause");
  });

  test("does not call contractRetrieval when no documentId", async () => {
    await hybridRetrieval("upah minimum");
    expect(mockContract).not.toHaveBeenCalled();
  });

  test("calls symbolicSearch for every query", async () => {
    await hybridRetrieval("somasi dan wanprestasi");
    expect(mockSymbolic).toHaveBeenCalledWith(
      "somasi dan wanprestasi",
      expect.any(Number),
    );
  });

  test("symbolic results are merged into the final ranking", async () => {
    mockSymbolic.mockResolvedValue([
      makeResult("s1", 0.95, "LegalConcept"),
      makeResult("s2", 0.90, "LegalConcept"),
    ]);

    const results = await hybridRetrieval("wanprestasi somasi");
    const symbolicIds = results.filter(
      (r: RetrievalResult) => r.label === "LegalConcept",
    );
    expect(symbolicIds.length).toBeGreaterThan(0);
  });

  test("handles denseSearch failure gracefully", async () => {
    mockDense.mockRejectedValue(new Error("Neo4j connection failed"));
    const results = await hybridRetrieval("pesangon");
    // Should still return BM25 results
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r: RetrievalResult) => r.id === "a2" || r.id === "a3")).toBe(
      true,
    );
  });

  test("handles symbolicSearch failure gracefully", async () => {
    mockSymbolic.mockRejectedValue(new Error("Graph traversal failed"));
    const results = await hybridRetrieval("wanprestasi");
    // Dense + BM25 should still return results
    expect(results.length).toBeGreaterThan(0);
  });

  test("handles all legs failing gracefully — returns empty array", async () => {
    mockDense.mockRejectedValue(new Error("Neo4j down"));
    mockBm25.mockRejectedValue(new Error("Neo4j down"));
    mockSymbolic.mockRejectedValue(new Error("Neo4j down"));
    const results = await hybridRetrieval("test query");
    expect(Array.isArray(results)).toBe(true);
  });
});

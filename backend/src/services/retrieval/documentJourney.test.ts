// Mock Neo4j: session.run returns queued results in call order
// (1st call = Document facts, 2nd call = pasal list).
const run = jest.fn();
const close = jest.fn().mockResolvedValue(undefined);
jest.mock("../../config/neo4j", () => ({
  getSession: jest.fn().mockResolvedValue({ run, close }),
}));

import { buildStructuralJourney } from "./documentJourney";

const rec = (obj: Record<string, unknown>) => ({
  get: (k: string) => obj[k],
});

beforeEach(() => {
  run.mockReset();
  close.mockClear();
});

describe("buildStructuralJourney", () => {
  it("assembles a fetch journey with ingestion aggregation", async () => {
    run
      .mockResolvedValueOnce({
        records: [rec({ ocrMethod: "pdf-parse", pageCount: 5, rawTextLength: 8200 })],
      })
      .mockResolvedValueOnce({
        records: [
          rec({
            n: 2,
            title: "MASA KERJA",
            ayatJson: '[{"number":1,"text":"a"},{"number":2,"text":"b"}]',
            charCount: 300,
          }),
          rec({ n: 5, title: "WAKTU DAN TEMPAT KERJA", ayatJson: "[]", charCount: 150 }),
        ],
      });

    const j = await buildStructuralJourney({
      documentId: "doc-1",
      routed: { kind: "structural_fetch", pasalNumber: 5 },
      question: "uraikan isi Pasal 5",
      matched: [{ pasal_number: 5, title: "WAKTU DAN TEMPAT KERJA" }],
      found: true,
      answerMode: "raw",
    });

    expect(j.ingestion.ocrMethod).toBe("pdf-parse");
    expect(j.ingestion.pageCount).toBe(5);
    expect(j.ingestion.rawTextLength).toBe(8200);
    expect(j.ingestion.pasalCount).toBe(2);
    expect(j.ingestion.pasalList[0]).toEqual({
      pasal_number: 2,
      title: "MASA KERJA",
      ayatCount: 2,
      charCount: 300,
    });
    expect(j.ingestion.pasalList[1].ayatCount).toBe(0);

    expect(j.retrieval.kind).toBe("fetch");
    expect(j.retrieval.parse.pasalNumber).toBe(5);
    expect(j.retrieval.cypher).toContain("pasal_number: 5");
    expect(j.retrieval.found).toBe(true);
    expect(j.retrieval.matched).toHaveLength(1);
    expect(close).toHaveBeenCalled();
  });

  it("builds a count journey with a count(DISTINCT ...) cypher", async () => {
    run
      .mockResolvedValueOnce({ records: [] }) // no Document node → null facts
      .mockResolvedValueOnce({
        records: [rec({ n: 1, title: "A", ayatJson: "[]", charCount: 10 })],
      });

    const j = await buildStructuralJourney({
      documentId: "doc-2",
      routed: { kind: "structural_count" },
      question: "berapa banyak pasal",
      matched: [{ pasal_number: 1, title: "A" }],
      found: true,
      answerMode: "natural",
    });

    expect(j.ingestion.ocrMethod).toBeNull();
    expect(j.ingestion.pageCount).toBeNull();
    expect(j.ingestion.rawTextLength).toBeNull();
    expect(j.retrieval.kind).toBe("count");
    expect(j.retrieval.cypher).toContain("count(DISTINCT");
    expect(j.retrieval.answerMode).toBe("natural");
  });
});

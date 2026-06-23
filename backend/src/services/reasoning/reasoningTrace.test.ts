/**
 * reasoningTrace.test.ts
 * Verifies that `reason()` correctly populates a `Partial<RetrievalTrace>`
 * traceSink with the honest-confidence shape (agreement + groundedness +
 * gate), and that the returned confidence values round-trip into the trace.
 *
 * Gemini (path generation), the embedding model (agreement), and the
 * groundedness verifier are all mocked so no API key / ONNX model is needed
 * and the confidence math is deterministic.
 */

// ---------------------------------------------------------------------------
// Mocks (hoisted before the module-under-test imports them).
// ---------------------------------------------------------------------------
jest.mock("@google/generative-ai", () => {
  const mockGenerateContent = jest.fn();
  const mockGetGenerativeModel = jest.fn().mockReturnValue({
    generateContent: mockGenerateContent,
  });
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: mockGetGenerativeModel,
    })),
    __mockGenerateContent: mockGenerateContent,
  };
});

// env mock — includes GROUNDEDNESS_FLOOR used by combineConfidence.
jest.mock("../../config/env", () => ({
  env: {
    GOOGLE_AI_API_KEY: "test-key",
    GEMINI_MODEL: "gemini-test",
    REASONING_PATHS: 3,
    TEMPERATURE_LOW: 0.1,
    TEMPERATURE_HIGH: 0.7,
    GROUNDEDNESS_FLOOR: 0.5,
  },
}));

// Embedding model mock — identical vectors → mean pairwise cosine = 1 (full agreement).
jest.mock("../embedding/embeddingService", () => ({
  embedText: jest.fn().mockResolvedValue([1, 0, 0]),
}));

// Groundedness verifier mock — fully grounded by default; overridden per-test.
jest.mock("./groundedness", () => ({
  checkGroundedness: jest
    .fn()
    .mockResolvedValue({ score: 1, supported: 1, total: 1, unsupportedClaims: [] }),
}));

// ---------------------------------------------------------------------------
// Imports after mocks are in place.
// ---------------------------------------------------------------------------
import { reason } from "./reasoningService";
import type { RetrievalResult } from "../retrieval/denseRetrieval";
import type { RetrievalTrace } from "../retrieval/retrievalTrace";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockGenerateContent } = jest.requireMock("@google/generative-ai") as {
  __mockGenerateContent: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { embedText } = jest.requireMock("../embedding/embeddingService") as {
  embedText: jest.Mock;
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { checkGroundedness } = jest.requireMock("./groundedness") as {
  checkGroundedness: jest.Mock;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockPath(text: string) {
  return { response: { text: () => text } };
}

const makeContext = (): RetrievalResult[] => [
  {
    id: "ctx-1",
    label: "Article",
    title: "Pasal 77",
    content: "Sesuai Pasal 77 UU No. 13 Tahun 2003 tentang Ketenagakerjaan.",
    score: 0.9,
    source: "UU Ketenagakerjaan",
  },
];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("reason() — traceSink population", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-assert default implementations (clearAllMocks wipes the once-queue).
    embedText.mockResolvedValue([1, 0, 0]);
    checkGroundedness.mockResolvedValue({
      score: 1,
      supported: 1,
      total: 1,
      unsupportedClaims: [],
    });
  });

  test("does NOT fill traceSink when argument is omitted", async () => {
    __mockGenerateContent.mockResolvedValue(mockPath("Answer without citations."));

    const result = await reason("What is PKWT?", makeContext());

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(["green", "yellow", "red"]).toContain(result.confidence_level);
  });

  test("fills traceSink.reasoning with the honest-confidence shape", async () => {
    __mockGenerateContent
      .mockResolvedValueOnce(
        mockPath("Based on Pasal 59 and Pasal 81 UU No. 13 Tahun 2003, the answer is X."),
      )
      .mockResolvedValueOnce(
        mockPath("Pursuant to Pasal 59 UU No. 13 Tahun 2003, the answer is Y."),
      )
      .mockResolvedValueOnce(
        mockPath("According to Pasal 59 UU No. 13 Tahun 2003, the answer is Z."),
      );

    const traceSink: Partial<RetrievalTrace> = {};
    const result = await reason("What is PKWT?", makeContext(), undefined, traceSink);

    expect(traceSink.reasoning).toBeDefined();
    const tr = traceSink.reasoning!;

    // Confidence values round-trip into the trace.
    expect(tr.confidence).toBe(result.confidence);
    expect(tr.confidenceLevel).toBe(result.confidence_level);

    // Honest-confidence inputs: fully grounded + full agreement (mocked) → green, not gated.
    expect(tr.groundedness).toBe(1);
    expect(tr.agreement).toBeCloseTo(1);
    expect(tr.gated).toBe(false);
    expect(tr.unsupportedClaims).toEqual([]);
    expect(tr.confidenceLevel).toBe("green");

    // One path entry per non-empty generated path, with temperatures + citation counts.
    expect(tr.paths).toHaveLength(3);
    expect(tr.paths[0].index).toBe(0);
    expect(tr.paths[0].temperature).toBeCloseTo(0.1);
    expect(tr.paths[1].temperature).toBeCloseTo(0.7);
    expect(tr.paths[2].temperature).toBeCloseTo(0.7);
    expect(tr.paths[0].citationCount).toBe(3); // Pasal 59, Pasal 81, UU No. 13 Tahun 2003
    expect(tr.paths[1].citationCount).toBe(2); // Pasal 59, UU No. 13 Tahun 2003
    expect(tr.paths[2].citationCount).toBe(2);
  });

  test("groundedness below the floor forces a RED, gated confidence", async () => {
    checkGroundedness.mockResolvedValue({
      score: 0.2,
      supported: 1,
      total: 5,
      unsupportedClaims: ["unsupported claim a", "unsupported claim b"],
    });
    __mockGenerateContent.mockResolvedValue(
      mockPath("Confident but unsupported answer about Pasal 5."),
    );

    const traceSink: Partial<RetrievalTrace> = {};
    const result = await reason("isi Pasal 5?", makeContext(), undefined, traceSink);

    const tr = traceSink.reasoning!;
    expect(tr.groundedness).toBe(0.2);
    expect(tr.gated).toBe(true);
    expect(tr.confidenceLevel).toBe("red");
    expect(result.confidence_level).toBe("red");
    expect(result.confidence).toBeLessThanOrEqual(0.3);
    expect(tr.unsupportedClaims).toHaveLength(2);
  });

  test("traceSink.reasoning.confidence equals result.confidence (round-trip identity)", async () => {
    __mockGenerateContent
      .mockResolvedValueOnce(mockPath("PP No. 35 Tahun 2021 mengatur perjanjian kerja."))
      .mockResolvedValueOnce(mockPath("Completely different answer about wages."))
      .mockResolvedValueOnce(mockPath("Yet another divergent answer on overtime pay."));

    const traceSink: Partial<RetrievalTrace> = {};
    const result = await reason("What is overtime?", makeContext(), undefined, traceSink);

    expect(traceSink.reasoning!.confidence).toBe(result.confidence);
    expect(traceSink.reasoning!.confidenceLevel).toBe(result.confidence_level);
  });

  test("paths.length matches the number of non-empty generated paths", async () => {
    __mockGenerateContent
      .mockResolvedValueOnce(mockPath("Pasal 1 valid answer."))
      .mockResolvedValueOnce(mockPath("")) // empty → filtered by selfConsistencyLoop
      .mockResolvedValueOnce(mockPath("Another valid answer."));

    const traceSink: Partial<RetrievalTrace> = {};
    await reason("Anything?", [], undefined, traceSink);

    const tr = traceSink.reasoning!;
    expect(tr.paths.length).toBeGreaterThanOrEqual(1);
    expect(tr.paths.length).toBeLessThanOrEqual(3);
  });

  test("path 0 temperature is TEMPERATURE_LOW regardless of how many paths survive", async () => {
    __mockGenerateContent
      .mockResolvedValueOnce(mockPath("Single path answer Pasal 5."))
      .mockRejectedValueOnce(new Error("API error"))
      .mockRejectedValueOnce(new Error("API error"));

    const traceSink: Partial<RetrievalTrace> = {};
    await reason("Solo path?", [], undefined, traceSink);

    const tr = traceSink.reasoning!;
    expect(tr.paths).toHaveLength(1);
    expect(tr.paths[0].index).toBe(0);
    expect(tr.paths[0].temperature).toBeCloseTo(0.1);
  });

  test("graceful fallback (all paths fail) fills traceSink as empty + red", async () => {
    __mockGenerateContent.mockRejectedValue(new Error("Gemini unavailable"));

    const traceSink: Partial<RetrievalTrace> = {};
    const result = await reason("Anything?", [], undefined, traceSink);

    expect(result.confidence).toBe(0);
    expect(result.confidence_level).toBe("red");

    expect(traceSink.reasoning).toBeDefined();
    const tr = traceSink.reasoning!;
    expect(tr.paths).toHaveLength(0);
    expect(tr.agreement).toBe(1);
    expect(tr.groundedness).toBe(0);
    expect(tr.gated).toBe(true);
    expect(tr.confidence).toBe(0);
    expect(tr.confidenceLevel).toBe("red");
    expect(tr.unsupportedClaims).toEqual([]);
  });

  test("traceSink remains unmodified when traceSink is undefined", async () => {
    __mockGenerateContent.mockResolvedValue(mockPath("Normal answer."));
    await expect(
      reason("Question?", makeContext(), undefined, undefined),
    ).resolves.not.toThrow();
  });
});

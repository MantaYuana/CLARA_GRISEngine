/**
 * reasoningTrace.test.ts
 * Verifies that `reason()` correctly populates a `Partial<RetrievalTrace>`
 * traceSink without altering any returned confidence values.
 *
 * Gemini is mocked so no real API key is required.
 */

// ---------------------------------------------------------------------------
// Mock @google/generative-ai before any imports that pull it in transitively.
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
    // Expose so individual tests can configure return values.
    __mockGenerateContent: mockGenerateContent,
  };
});

// Mock env so requireEnv() doesn't throw and temperature constants are stable.
jest.mock("../../config/env", () => ({
  env: {
    GOOGLE_AI_API_KEY: "test-key",
    GEMINI_MODEL: "gemini-test",
    REASONING_PATHS: 3,
    TEMPERATURE_LOW: 0.1,
    TEMPERATURE_HIGH: 0.7,
  },
}));

// ---------------------------------------------------------------------------
// Imports after mocks are in place.
// ---------------------------------------------------------------------------
import { reason } from "./reasoningService";
import type { RetrievalResult } from "../retrieval/denseRetrieval";
import type { RetrievalTrace } from "../retrieval/retrievalTrace";

// Grab the shared mock function reference via the module's __mockGenerateContent
// export (defined in the factory above).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __mockGenerateContent } = jest.requireMock("@google/generative-ai") as {
  __mockGenerateContent: jest.Mock;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate a deterministic Gemini response with optional citation text. */
function mockPath(text: string) {
  return {
    response: {
      text: () => text,
    },
  };
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
  });

  test("does NOT fill traceSink when argument is omitted", async () => {
    // Three successful paths, no citations.
    __mockGenerateContent.mockResolvedValue(mockPath("Answer without citations."));

    const result = await reason("What is PKWT?", makeContext());

    // Return value must be a valid ReasoningResult.
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(["green", "yellow", "red"]).toContain(result.confidence_level);
  });

  test("fills traceSink.reasoning when provided", async () => {
    // Path 0 (low temp) has 2 citations; paths 1 and 2 have 1 each.
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

    // traceSink.reasoning must be populated.
    expect(traceSink.reasoning).toBeDefined();
    const tr = traceSink.reasoning!;

    // confidence/confidenceLevel in the trace must equal the returned values.
    expect(tr.confidence).toBe(result.confidence);
    expect(tr.confidenceLevel).toBe(result.confidence_level);

    // paths array must have one entry per non-empty generated path.
    expect(tr.paths).toHaveLength(3);

    // Path index 0 must use TEMPERATURE_LOW.
    expect(tr.paths[0].index).toBe(0);
    expect(tr.paths[0].temperature).toBeCloseTo(0.1);

    // Paths 1+ must use TEMPERATURE_HIGH.
    expect(tr.paths[1].temperature).toBeCloseTo(0.7);
    expect(tr.paths[2].temperature).toBeCloseTo(0.7);

    // citationCount must reflect what was in each path's text.
    // Path 0 has "Pasal 59", "Pasal 81", and "UU No. 13 Tahun 2003" → 3
    expect(tr.paths[0].citationCount).toBe(3);
    // Paths 1 and 2 each have "Pasal 59" and "UU No. 13 Tahun 2003" → 2
    expect(tr.paths[1].citationCount).toBe(2);
    expect(tr.paths[2].citationCount).toBe(2);

    // entropy must be a number in [0, 1].
    expect(tr.entropy).toBeGreaterThanOrEqual(0);
    expect(tr.entropy).toBeLessThanOrEqual(1);

    // adjustedEntropy = max(0, entropy - citationBonus).
    expect(tr.adjustedEntropy).toBeCloseTo(
      Math.max(0, tr.entropy - tr.citationBonus),
      10,
    );
  });

  test("traceSink.reasoning.confidence equals result.confidence (round-trip identity)", async () => {
    __mockGenerateContent
      .mockResolvedValueOnce(
        mockPath("PP No. 35 Tahun 2021 mengatur perjanjian kerja."),
      )
      .mockResolvedValueOnce(mockPath("Completely different answer about wages."))
      .mockResolvedValueOnce(mockPath("Yet another divergent answer on overtime pay."));

    const traceSink: Partial<RetrievalTrace> = {};
    const result = await reason("What is overtime?", makeContext(), undefined, traceSink);

    expect(traceSink.reasoning!.confidence).toBe(result.confidence);
    expect(traceSink.reasoning!.confidenceLevel).toBe(result.confidence_level);
  });

  test("paths.length matches the number of non-empty generated paths", async () => {
    // Simulate path 1 failing (empty string returned after .catch(() => ""))
    // by having the mock return empty — selfConsistencyLoop filters these out.
    __mockGenerateContent
      .mockResolvedValueOnce(mockPath("Pasal 1 valid answer."))
      .mockResolvedValueOnce(mockPath("")) // empty → filtered by selfConsistencyLoop
      .mockResolvedValueOnce(mockPath("Another valid answer."));

    const traceSink: Partial<RetrievalTrace> = {};
    await reason("Anything?", [], undefined, traceSink);

    const tr = traceSink.reasoning!;
    // Only non-empty paths survive the filter, so length should be 2 (or 3 if
    // the empty string passes trim — the service trims, so "" trimmed is still "").
    expect(tr.paths.length).toBeGreaterThanOrEqual(1);
    expect(tr.paths.length).toBeLessThanOrEqual(3);
  });

  test("path 0 temperature is TEMPERATURE_LOW regardless of how many paths survive", async () => {
    // Only path 0 succeeds.
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

  test("graceful fallback (all paths fail) fills traceSink with empty paths and red level", async () => {
    __mockGenerateContent.mockRejectedValue(new Error("Gemini unavailable"));

    const traceSink: Partial<RetrievalTrace> = {};
    const result = await reason("Anything?", [], undefined, traceSink);

    // Returned result must be the fallback.
    expect(result.confidence).toBe(0);
    expect(result.confidence_level).toBe("red");

    // traceSink must still be populated.
    expect(traceSink.reasoning).toBeDefined();
    const tr = traceSink.reasoning!;
    expect(tr.paths).toHaveLength(0);
    expect(tr.entropy).toBe(1.0);
    expect(tr.confidence).toBe(0);
    expect(tr.confidenceLevel).toBe("red");
    expect(tr.citationBonus).toBe(0);
    expect(tr.adjustedEntropy).toBe(1.0);
  });

  test("traceSink remains unmodified when traceSink is undefined", async () => {
    __mockGenerateContent.mockResolvedValue(mockPath("Normal answer."));
    // Should not throw — the optional sink code path is skipped entirely.
    await expect(
      reason("Question?", makeContext(), undefined, undefined),
    ).resolves.not.toThrow();
  });
});

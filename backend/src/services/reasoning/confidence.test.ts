import { combineConfidence, meanPairwiseCosine } from "./reasoningService";

describe("combineConfidence (groundedness gate)", () => {
  it("forces RED when groundedness below floor, even if agreement is high", () => {
    const c = combineConfidence(0.2, 1.0); // the Pasal 5 case
    expect(c.level).toBe("red");
    expect(c.score).toBeLessThanOrEqual(0.3);
  });
  it("greens when both are high", () => {
    expect(combineConfidence(0.9, 0.9).level).toBe("green");
  });
  it("yellows in the middle", () => {
    expect(combineConfidence(0.7, 0.6).level).toBe("yellow");
  });
});

describe("meanPairwiseCosine", () => {
  it("returns 1 for a single vector", () => {
    expect(meanPairwiseCosine([[1, 0]])).toBe(1);
  });
  it("returns ~0 for orthogonal normalized vectors", () => {
    expect(
      meanPairwiseCosine([
        [1, 0],
        [0, 1],
      ]),
    ).toBeCloseTo(0, 5);
  });
});

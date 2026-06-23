import { scoreFromClaims } from "./groundedness";

describe("scoreFromClaims", () => {
  it("computes supported fraction", () => {
    const r = scoreFromClaims([
      { claim: "Pasal 5 mengatur jam kerja", supported: true },
      { claim: "Kontrak punya 6 pasal", supported: false },
    ]);
    expect(r.score).toBe(0.5);
    expect(r.unsupportedClaims).toEqual(["Kontrak punya 6 pasal"]);
    expect(r.total).toBe(2);
  });
  it("is safe on empty", () => {
    expect(scoreFromClaims([]).score).toBe(1);
  });
});

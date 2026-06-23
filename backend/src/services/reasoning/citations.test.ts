import { parseLegalRef, refMatchesNode } from "./reasoningService";

describe("citation matching", () => {
  it("parses pasal + uu", () => {
    expect(parseLegalRef("Pasal 59 UU No. 13 Tahun 2003")).toMatchObject({
      pasal: 59,
      uuNumber: 13,
      uuYear: 2003,
    });
  });
  it("does NOT match Pasal 5 against a Pasal 59 node", () => {
    const node = { id: "a-59", title: "Pasal 59", content: "", pasal_number: 59 } as any;
    expect(refMatchesNode("Pasal 5", node)).toBe(false);
  });
  it("matches Pasal 5 against a Pasal 5 node", () => {
    const node = { id: "a-5", title: "Pasal 5", content: "", pasal_number: 5 } as any;
    expect(refMatchesNode("Pasal 5", node)).toBe(true);
  });
});

import { buildClauseParams } from "./clauseStore";

describe("buildClauseParams", () => {
  it("serialises ayat to JSON and carries pasal_number + title", () => {
    const p = buildClauseParams("doc-1", "user-1", {
      index: 3,
      header: "PASAL 5",
      title: "WAKTU DAN TEMPAT KERJA",
      pasal_number: 5,
      content: "...",
      ayat: [{ number: 1, text: "Senin-Jumat" }],
      content_preview: "...",
      pasal_references: [],
    });
    expect(p.id).toBe("doc-1-3");
    expect(p.pasalNumber).toBe(5);
    expect(p.title).toBe("WAKTU DAN TEMPAT KERJA");
    expect(JSON.parse(p.ayatJson)).toEqual([{ number: 1, text: "Senin-Jumat" }]);
  });
});

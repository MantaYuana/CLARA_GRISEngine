import { classifyQuestion } from "./intentRouter";

describe("classifyQuestion", () => {
  it("returns reasoning when no document", () => {
    expect(classifyQuestion("berapa pasal", false).kind).toBe("reasoning");
  });
  it("detects count", () => {
    expect(classifyQuestion("coba sebutkan berapa banyak pasal", true).kind).toBe(
      "structural_count",
    );
  });
  it("detects fetch with pasal + ayat numbers", () => {
    const r = classifyQuestion("tolong uraikan isi Pasal 5 ayat 2", true);
    expect(r.kind).toBe("structural_fetch");
    expect(r.pasalNumber).toBe(5);
    expect(r.ayatNumber).toBe(2);
  });
  it("detects list", () => {
    expect(classifyQuestion("sebutkan semua pasal dalam kontrak ini", true).kind).toBe(
      "structural_list",
    );
  });
  it("treats a statute reference as reasoning, not document fetch", () => {
    expect(classifyQuestion("apakah sesuai Pasal 59 UU 13 Tahun 2003?", true).kind).toBe(
      "reasoning",
    );
  });
  it("falls back to reasoning for content questions", () => {
    expect(classifyQuestion("apa hak dan kewajiban saya?", true).kind).toBe("reasoning");
  });
});

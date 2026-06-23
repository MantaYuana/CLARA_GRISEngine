import { formatStructuralAnswer } from "./answerService";

describe("formatStructuralAnswer (raw)", () => {
  it("formats a count", () => {
    const a = formatStructuralAnswer(
      { kind: "structural_count" } as any,
      { count: 7, list: [], pasal: null },
      "raw",
    );
    expect(a).toContain("7");
  });
  it("formats a fetch with ayat", () => {
    const a = formatStructuralAnswer(
      { kind: "structural_fetch", pasalNumber: 5, ayatNumber: 2 } as any,
      {
        count: 0,
        list: [],
        pasal: {
          pasal_number: 5,
          title: "WAKTU DAN TEMPAT KERJA",
          content: "x",
          ayat: [{ number: 2, text: "Istirahat 12:00" }],
        },
      },
      "raw",
    );
    expect(a).toContain("Pasal 5");
    expect(a).toContain("Istirahat 12:00");
  });
});

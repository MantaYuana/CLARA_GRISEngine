import { pickAyat } from "./documentStructure";

describe("pickAyat", () => {
  const ayatJson = JSON.stringify([
    { number: 1, text: "Senin-Jumat" },
    { number: 2, text: "Istirahat 12:00-13:00" },
  ]);
  it("returns a specific ayat", () => {
    expect(pickAyat(ayatJson, 2)).toBe("Istirahat 12:00-13:00");
  });
  it("returns null for a missing ayat", () => {
    expect(pickAyat(ayatJson, 9)).toBeNull();
  });
  it("is null-safe on bad json", () => {
    expect(pickAyat("not json", 1)).toBeNull();
  });
});

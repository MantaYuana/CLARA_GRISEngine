import { segmentClauses } from "./ocrService";

const PKWT = `PERJANJIAN KERJA WAKTU TERTENTU
Pasal 1
KETENTUAN UMUM
1. Para pihak sepakat.
2. Istilah diatur di sini.
Pasal 2
PENUNJUKAN SEBAGAI KARYAWAN
1. Pihak Kedua ditunjuk.
5. Selama masa kontrak, Pihak Kedua dapat mengundurkan diri dengan pemberitahuan.
Pasal 5
WAKTU DAN TEMPAT KERJA
1. Hari kerja Senin sampai Jumat pukul 08:00-17:00.
2. Istirahat pukul 12:00-13:00.`;

describe("segmentClauses (Pasal-aware)", () => {
  const clauses = segmentClauses(PKWT);

  it("splits on Pasal headers only, not numbered ayat", () => {
    const pasals = clauses.filter((c) => c.pasal_number != null);
    expect(pasals.map((c) => c.pasal_number)).toEqual([1, 2, 5]);
  });

  it("keeps ayat inside the parent Pasal", () => {
    const p2 = clauses.find((c) => c.pasal_number === 2)!;
    expect(p2.content).toContain("mengundurkan diri");
    expect(p2.ayat.map((a) => a.number)).toEqual([1, 5]);
  });

  it("captures the title and never confuses ayat 5 with Pasal 5", () => {
    const p5 = clauses.find((c) => c.pasal_number === 5)!;
    expect(p5.title.toUpperCase()).toContain("WAKTU DAN TEMPAT KERJA");
    expect(p5.content).toContain("08:00");
    expect(p5.content).not.toContain("mengundurkan diri");
  });
});

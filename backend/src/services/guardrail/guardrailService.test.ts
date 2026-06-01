/**
 * guardrailService.test.ts
 * Unit tests for the guardrail service. Neo4j calls are gracefully skipped
 * when the database is unavailable (numeric checks silently catch errors).
 */
import { runGuardrailChecks, GuardrailCheck } from "./guardrailService";

describe("GuardrailService — keyword checks", () => {
  test("detects forced seizure (penyitaan paksa) as CRITICAL", async () => {
    const text =
      "Pihak A berhak melakukan penyitaan paksa atas aset Pihak B jika terjadi wanprestasi.";
    const report = await runGuardrailChecks(text);

    const forced = report.checks.find((c: GuardrailCheck) => c.name === "forced_seizure");
    expect(forced).toBeDefined();
    expect(forced!.triggered).toBe(true);
    expect(forced!.severity).toBe("CRITICAL");
    expect(report.critical_violations).toHaveLength(1);
    expect(report.is_safe).toBe(false);
  });

  test("detects forced seizure (sita jaminan paksa) as CRITICAL", async () => {
    const text =
      "Kreditur dapat melakukan sita jaminan paksa tanpa persetujuan pengadilan.";
    const report = await runGuardrailChecks(text);

    const forced = report.checks.find((c: GuardrailCheck) => c.name === "forced_seizure");
    expect(forced!.triggered).toBe(true);
    expect(forced!.severity).toBe("CRITICAL");
  });

  test("detects unilateral termination as WARNING", async () => {
    const text =
      "Pihak Pertama berhak mengakhiri perjanjian secara sepihak tanpa pemberitahuan.";
    const report = await runGuardrailChecks(text);

    const uni = report.checks.find(
      (c: GuardrailCheck) => c.name === "unilateral_termination",
    );
    expect(uni).toBeDefined();
    expect(uni!.triggered).toBe(true);
    expect(uni!.severity).toBe("WARNING");
  });

  test("detects waiver_of_rights as WARNING", async () => {
    const text =
      "Pihak B dengan ini melepaskan hak untuk menuntut ganti rugi atas keterlambatan pengiriman.";
    const report = await runGuardrailChecks(text);

    const waiver = report.checks.find(
      (c: GuardrailCheck) => c.name === "waiver_of_rights",
    );
    expect(waiver).toBeDefined();
    expect(waiver!.triggered).toBe(true);
    expect(waiver!.severity).toBe("WARNING");
    expect(waiver!.legal_basis).toContain("1321");
  });

  test("detects 'mengesampingkan hak' as waiver_of_rights", async () => {
    const text = "Para pihak sepakat untuk mengesampingkan hak mereka atas arbitrase.";
    const report = await runGuardrailChecks(text);

    const waiver = report.checks.find(
      (c: GuardrailCheck) => c.name === "waiver_of_rights",
    );
    expect(waiver!.triggered).toBe(true);
  });

  test("critical_violations is always present and empty on a clean contract", async () => {
    const text = `
      Perjanjian ini dibuat antara PT Maju Bersama dan CV Karya Jaya.
      Ruang lingkup kerja sama: pengadaan bahan baku kopi.
      Jangka waktu: 12 bulan.
      Penyelesaian sengketa melalui Pengadilan Negeri Jakarta Pusat.
    `;
    const report = await runGuardrailChecks(text);

    expect(report.critical_violations).toBeDefined();
    expect(Array.isArray(report.critical_violations)).toBe(true);
    expect(report.critical_violations).toHaveLength(0);
    expect(report.is_safe).toBe(true);
  });

  test("advice is populated for triggered checks", async () => {
    const text = "Klausula penyitaan berlaku jika debitur gagal membayar.";
    const report = await runGuardrailChecks(text);

    const triggered = report.checks.filter((c: GuardrailCheck) => c.triggered);
    triggered.forEach((check: GuardrailCheck) => {
      expect(check.advice).toBeTruthy();
      expect(check.advice.length).toBeGreaterThan(0);
    });
  });

  test("legal_basis is included on critical checks", async () => {
    const text = "Penyitaan paksa diperbolehkan sesuai perjanjian ini.";
    const report = await runGuardrailChecks(text);

    const critical = report.critical_violations[0];
    expect(critical).toBeDefined();
    expect(critical.legal_basis).toBeDefined();
    expect(critical.legal_basis!.length).toBeGreaterThan(0);
  });

  test("extracted_variables is always present in the report", async () => {
    const text = "Perjanjian kerja sama antara dua pihak.";
    const report = await runGuardrailChecks(text);

    expect(report.extracted_variables).toBeDefined();
    expect(typeof report.extracted_variables).toBe("object");
  });
});

describe("GuardrailService — numeric extraction", () => {
  test("parses retention percentage from contract text", async () => {
    const text = `
      Pihak Kedua sepakat untuk menahan retensi 5% dari setiap pembayaran milestone
      sebagai jaminan penyelesaian proyek.
      Penyelesaian sengketa melalui mediasi.
    `;
    const report = await runGuardrailChecks(text);
    expect(report.extracted_variables.retention_percent).toBe(5);
  });

  test("parses DP percentage from contract text", async () => {
    const text = `
      Pihak Pertama wajib membayar uang muka 30% dari total nilai kontrak
      sebelum pekerjaan dimulai.
      Penyelesaian sengketa melalui arbitrase.
    `;
    const report = await runGuardrailChecks(text);
    expect(report.extracted_variables.dp_percent).toBe(30);
  });

  test("parses penalty lump-sum in IDR", async () => {
    const text = `
      Dalam hal keterlambatan, Pihak Kedua dikenakan denda sebesar Rp 50.000.000
      per bulan keterlambatan.
      Penyelesaian sengketa melalui pengadilan.
    `;
    const report = await runGuardrailChecks(text);
    expect(report.extracted_variables.penalty_lump_sum_idr).toBe(50_000_000);
  });

  test("parses late interest per day", async () => {
    const text = `
      Pihak yang terlambat membayar dikenakan bunga keterlambatan 0,1% per hari
      sampai pembayaran lunas. Sengketa diselesaikan melalui mediasi.
    `;
    const report = await runGuardrailChecks(text);
    expect(report.extracted_variables.late_interest_percent_per_day).toBeCloseTo(0.1);
  });

  test("returns empty extracted_variables when no numeric terms found", async () => {
    const text = `
      Perjanjian ini mengatur ruang lingkup kerja sama secara umum.
      Penyelesaian sengketa melalui pengadilan negeri.
    `;
    const report = await runGuardrailChecks(text);
    expect(report.extracted_variables.interest_percent_per_month).toBeUndefined();
    expect(report.extracted_variables.penalty_percent_per_month).toBeUndefined();
    expect(report.extracted_variables.pkwt_duration_years).toBeUndefined();
  });
});

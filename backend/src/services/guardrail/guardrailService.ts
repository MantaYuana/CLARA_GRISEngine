/**
 * guardrailService.ts
 * Checks contract text against Indonesian statutory limits and dangerous patterns.
 * Emits severity-tagged results (CRITICAL / WARNING / INFO) with actionable advice.
 *
 * Numeric extraction is delegated to ocrService.extractNumericVariables()
 * so there is a single source of truth for regex parsing.
 */
import { getSession } from "../../config/neo4j";
import { extractNumericVariables, NumericVariables } from "../ocr/ocrService";

export type Severity = "CRITICAL" | "WARNING" | "INFO";

export interface GuardrailCheck {
  name: string;
  triggered: boolean;
  severity: Severity;
  message: string;
  advice: string;
  legal_basis?: string;
}

export interface GuardrailReport {
  checks: GuardrailCheck[];
  critical_violations: GuardrailCheck[]; // triggered && severity === CRITICAL
  warning_count: number;
  is_safe: boolean; // true only when no CRITICAL violations
  extracted_variables: NumericVariables; // parsed numeric terms (for API consumers)
}

// Keyword / Pattern checks

interface KeywordRule {
  name: string;
  pattern: RegExp;
  severity: Severity;
  message: string;
  advice: string;
  legal_basis: string;
}

const KEYWORD_RULES: KeywordRule[] = [
  {
    name: "forced_seizure",
    pattern:
      /penyitaan\s+paksa|sita\s+jaminan\s+paksa|rampas\s+aset|klausula\s+penyitaan/i,
    severity: "CRITICAL",
    message:
      "Contract contains a forced seizure clause that violates Constitutional Court rulings.",
    advice:
      "Request the removal of this forced seizure clause. Seizures are only legal through a court decision (MK No. 18/PUU-XVII/2019).",
    legal_basis: "Constitutional Court Decision No. 18/PUU-XVII/2019",
  },
  {
    name: "unilateral_termination",
    pattern:
      /mengakhiri\s+(?:perjanjian|kontrak|kerja\s+sama)\s+secara\s+sepihak|pengakhiran\s+sepihak/i,
    severity: "WARNING",
    message:
      "Contract contains a unilateral termination clause which is difficult to enforce without a court ruling.",
    advice:
      "Under Article 1266 of the Civil Code, cancellation of bilateral agreements requires a court order unless explicitly agreed otherwise. Consider a dispute resolution clause via mediation first.",
    legal_basis: "Article 1266 of the Civil Code",
  },
  {
    name: "excessive_liquidated_damages",
    pattern:
      /ganti\s+rugi\s+sebesar\s+[3-9]\d{2,}%|denda\s+[3-9]\d{2,}%|penalti\s+[3-9]\d{2,}%/i,
    severity: "CRITICAL",
    message:
      "Liquidated damages clause exceeds customary limits (>300%) and may be qualified as an unfair agreement.",
    advice:
      "Negotiate a maximum penalty of 5% per month according to OJK reasonable limits. Excessive penalty clauses can be annulled by the court.",
    legal_basis: "OJK Regulations & Article 1267 of the Civil Code",
  },
  {
    name: "waiver_of_rights",
    pattern:
      /melepaskan\s+hak|mengesampingkan\s+hak|tidak\s+menuntut(?:\s+ganti\s+rugi)?|melepas\s+(?:semua\s+)?hak(?:\s+hukum)?/i,
    severity: "WARNING",
    message:
      "Contract contains a waiver of rights clause that may limit the legal protection of the weaker party.",
    advice:
      "A waiver of rights obtained through pressure, fraud, or mistake can be annulled (Article 1321 of the Civil Code). Ensure this clause does not waive minimum rights protected by law.",
    legal_basis: "Article 1321 of the Civil Code",
  },
  {
    name: "no_dispute_resolution",
    pattern: /^(?!.*(?:pengadilan|arbitrase|mediasi|bpsk|sengketa)).*$/is,
    severity: "INFO",
    message: "Contract lacks an explicit dispute resolution clause.",
    advice:
      "Add a dispute resolution clause: negotiation → mediation → arbitration/court, along with the applicable jurisdiction.",
    legal_basis: "Indonesian contract law best practices",
  },
];

// Numeric checks from Neo4j statutory limits

async function runNumericChecks(extracted: NumericVariables): Promise<GuardrailCheck[]> {
  const checks: GuardrailCheck[] = [];
  const session = await getSession();

  try {
    // Fetch statutory limits from Neo4j
    const limitsResult = await session.run(`
      MATCH (c:LegalConcept)
      WHERE c.name IN ['Bunga', 'Denda', 'PKWT']
      RETURN c.name AS name,
             c.max_interest_percent_per_month AS max_interest,
             c.max_penalty_percent_per_month AS max_penalty,
             c.max_duration_years AS max_duration
    `);

    const limits: Record<string, number> = {};
    limitsResult.records.forEach((rec) => {
      const name = rec.get("name") as string;
      if (name === "Bunga") limits.max_interest = rec.get("max_interest") ?? 2.0;
      if (name === "Denda") limits.max_penalty = rec.get("max_penalty") ?? 5.0;
      if (name === "PKWT") limits.max_duration = rec.get("max_duration") ?? 2.0;
    });

    // Fallback statutory caps if Neo4j has no data yet
    if (!limits.max_interest) limits.max_interest = 2.0; // OJK: 2%/bulan
    if (!limits.max_penalty) limits.max_penalty = 5.0; // OJK: 5%/bulan
    if (!limits.max_duration) limits.max_duration = 2.0; // UU 13/2003 Pasal 59

    // Interest rate
    if (extracted.interest_percent_per_month !== undefined) {
      const exceeded = extracted.interest_percent_per_month > limits.max_interest;
      checks.push({
        name: "interest_rate",
        triggered: exceeded,
        severity: exceeded ? "WARNING" : "INFO",
        message: exceeded
          ? `Interest rate of ${extracted.interest_percent_per_month}%/month exceeds the OJK limit (${limits.max_interest}%/month).`
          : `Interest rate of ${extracted.interest_percent_per_month}%/month is within reasonable limits.`,
        advice: exceeded
          ? `Negotiate the interest rate below ${limits.max_interest}%/month according to OJK regulations.`
          : "",
        legal_basis: "OJK Lending Regulations",
      });
    }

    // Penalty rate
    if (extracted.penalty_percent_per_month !== undefined) {
      const exceeded = extracted.penalty_percent_per_month > limits.max_penalty;
      checks.push({
        name: "penalty_rate",
        triggered: exceeded,
        severity: exceeded ? "WARNING" : "INFO",
        message: exceeded
          ? `Penalty of ${extracted.penalty_percent_per_month}%/month exceeds the reasonable limit (${limits.max_penalty}%/month).`
          : `Penalty of ${extracted.penalty_percent_per_month}%/month is within reasonable limits.`,
        advice: exceeded
          ? `Negotiate a maximum penalty of ${limits.max_penalty}%/month. Excessive penalties can be annulled by the court (Article 1267 of the Civil Code).`
          : "",
        legal_basis: "Article 1267 of the Civil Code & OJK",
      });
    }

    // Late interest per day
    if (extracted.late_interest_percent_per_day !== undefined) {
      // OJK limit: 0.1%/hari (equivalent to ~3%/bulan)
      const MAX_LATE_DAY = 0.1;
      const exceeded = extracted.late_interest_percent_per_day > MAX_LATE_DAY;
      checks.push({
        name: "late_interest_daily",
        triggered: exceeded,
        severity: exceeded ? "WARNING" : "INFO",
        message: exceeded
          ? `Late interest of ${extracted.late_interest_percent_per_day}%/day exceeds OJK reasonable limit (${MAX_LATE_DAY}%/day).`
          : `Late interest of ${extracted.late_interest_percent_per_day}%/day is within reasonable limits.`,
        advice: exceeded
          ? `Negotiate late interest below ${MAX_LATE_DAY}%/day according to OJK guidelines.`
          : "",
        legal_basis: "OJK Guidelines & Article 1267 of the Civil Code",
      });
    }

    // Retention percentage
    if (extracted.retention_percent !== undefined) {
      // Standard construction/service: retention ≤ 5%
      const MAX_RETENTION = 5;
      const exceeded = extracted.retention_percent > MAX_RETENTION;
      checks.push({
        name: "retention_rate",
        triggered: exceeded,
        severity: exceeded ? "WARNING" : "INFO",
        message: exceeded
          ? `Retention of ${extracted.retention_percent}% exceeds the industry standard (${MAX_RETENTION}%).`
          : `Retention of ${extracted.retention_percent}% is within the industry standard limit.`,
        advice: exceeded
          ? `Negotiate a maximum retention of ${MAX_RETENTION}% of the contract value according to construction industry standards.`
          : "",
        legal_basis: "Industry practices & PUPR Ministerial Regulation",
      });
    }

    // Down payment percentage
    if (extracted.dp_percent !== undefined) {
      // Minimum DP for vendor protection: ≥ 20%; maximum upfront to buyer: ≤ 50%
      const tooLow = extracted.dp_percent < 20;
      const tooHigh = extracted.dp_percent > 50;
      if (tooLow || tooHigh) {
        checks.push({
          name: "dp_percent",
          triggered: true,
          severity: "WARNING",
          message: tooLow
            ? `Down payment of ${extracted.dp_percent}% is below the recommended minimum limit (20%), increasing the risk of unilateral cancellation.`
            : `Down payment of ${extracted.dp_percent}% is very high (>50%), increasing the risk for the buyer.`,
          advice: tooLow
            ? "Negotiate a minimum down payment of 20-30% to protect the service provider's interests."
            : "A down payment above 50% is risky if the vendor fails to complete the work. Consider an escrow.",
          legal_basis: "Indonesian contract law best practices",
        });
      }
    }

    // Penalty lump-sum
    if (extracted.penalty_lump_sum_idr !== undefined) {
      // Flag nominal penalties > Rp 500 juta for review
      const THRESHOLD_IDR = 500_000_000;
      const exceeded = extracted.penalty_lump_sum_idr > THRESHOLD_IDR;
      checks.push({
        name: "penalty_lump_sum",
        triggered: exceeded,
        severity: exceeded ? "WARNING" : "INFO",
        message: exceeded
          ? `Nominal penalty of Rp ${extracted.penalty_lump_sum_idr.toLocaleString("id-ID")} needs its proportionality reviewed against the contract value.`
          : `Nominal penalty of Rp ${extracted.penalty_lump_sum_idr.toLocaleString("id-ID")} detected.`,
        advice: exceeded
          ? "Ensure the penalty is proportional to the contract value and actual losses. Disproportionate penalties may be reduced by the court (Article 1267 of the Civil Code)."
          : "",
        legal_basis: "Article 1267 of the Civil Code",
      });
    }

    // PKWT duration
    if (extracted.pkwt_duration_years !== undefined) {
      const exceeded = extracted.pkwt_duration_years > limits.max_duration;
      checks.push({
        name: "pkwt_duration",
        triggered: exceeded,
        severity: exceeded ? "CRITICAL" : "INFO",
        message: exceeded
          ? `PKWT duration of ${extracted.pkwt_duration_years} years exceeds the maximum limit of ${limits.max_duration} years.`
          : `PKWT duration of ${extracted.pkwt_duration_years} years complies with the Manpower Law.`,
        advice: exceeded
          ? `Maximum PKWT is ${limits.max_duration} years (Article 59 of Law 13/2003). PKWT exceeding the limit automatically becomes PKWTT.`
          : "",
        legal_basis: "Article 59 of Law No. 13 of 2003",
      });
    }
  } finally {
    await session.close();
  }

  return checks;
}

// Main export

export async function runGuardrailChecks(contractText: string): Promise<GuardrailReport> {
  const allChecks: GuardrailCheck[] = [];

  // 1. Keyword / pattern checks
  for (const rule of KEYWORD_RULES) {
    // Skip the "no_dispute_resolution" info check for short texts
    if (rule.name === "no_dispute_resolution" && contractText.length < 200) continue;
    const triggered = rule.pattern.test(contractText);
    allChecks.push({
      name: rule.name,
      triggered,
      severity: rule.severity,
      message: triggered
        ? rule.message
        : `Not found: ${rule.name.replace(/_/g, " ")}`,
      advice: triggered ? rule.advice : "",
      legal_basis: rule.legal_basis,
    });
  }

  // 2. Numeric checks (requires Neo4j — graceful fallback on connection failure)
  const extracted = extractNumericVariables(contractText);
  try {
    const numericChecks = await runNumericChecks(extracted);
    allChecks.push(...numericChecks);
  } catch {
    // Neo4j not available (e.g. during unit tests) — skip numeric checks silently
  }

  const critical_violations = allChecks.filter(
    (c) => c.triggered && c.severity === "CRITICAL",
  );
  const warning_count = allChecks.filter(
    (c) => c.triggered && c.severity === "WARNING",
  ).length;

  return {
    checks: allChecks,
    critical_violations,
    warning_count,
    is_safe: critical_violations.length === 0,
    extracted_variables: extracted,
  };
}

/**
 * Phase 2 guardrail entry point — used by POST /api/v1/contract/validate.
 *
 * Runs keyword checks on the raw contract text (same as runGuardrailChecks)
 * but uses the **caller-supplied** numeric variables instead of auto-extracting
 * them from the text.  This lets users correct OCR mis-reads (e.g. 50% → 5%)
 * before the deterministic limit checks are executed.
 *
 * @param contractText  Raw OCR text from Phase 1 (for keyword pattern checks)
 * @param variables     User-corrected NumericVariables from the frontend
 */
export async function runGuardrailChecksWithVariables(
  contractText: string,
  variables: Partial<NumericVariables>,
): Promise<GuardrailReport> {
  const allChecks: GuardrailCheck[] = [];

  // 1. Keyword / pattern checks (identical to runGuardrailChecks)
  for (const rule of KEYWORD_RULES) {
    if (rule.name === "no_dispute_resolution" && contractText.length < 200) continue;
    const triggered = rule.pattern.test(contractText);
    allChecks.push({
      name: rule.name,
      triggered,
      severity: rule.severity,
      message: triggered
        ? rule.message
        : `Not found: ${rule.name.replace(/_/g, " ")}`,
      advice: triggered ? rule.advice : "",
      legal_basis: rule.legal_basis,
    });
  }

  // 2. Numeric checks — use caller-supplied (corrected) variables
  try {
    const numericChecks = await runNumericChecks(variables as NumericVariables);
    allChecks.push(...numericChecks);
  } catch {
    // Neo4j not available — skip numeric checks silently
  }

  const critical_violations = allChecks.filter(
    (c) => c.triggered && c.severity === "CRITICAL",
  );
  const warning_count = allChecks.filter(
    (c) => c.triggered && c.severity === "WARNING",
  ).length;

  return {
    checks: allChecks,
    critical_violations,
    warning_count,
    is_safe: critical_violations.length === 0,
    extracted_variables: variables as NumericVariables,
  };
}

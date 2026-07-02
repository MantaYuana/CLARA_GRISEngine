/**
 * ocrService.ts
 * Extracts text from files using:
 *  – Gemini multimodal for images (JPEG, PNG, WebP, etc.)
 *  – pdf-parse for local PDF text extraction (no API calls)
 * Then applies Indonesian OCR correction logic and segments the text into
 * structured contract clauses.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PDFParse } from "pdf-parse";
import { env } from "../../config/env";

const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

// Types

export interface Ayat {
  number: number;
  text: string;
}

export interface Clause {
  index: number;
  header: string;
  title: string; // heading line(s) after "Pasal N"
  pasal_number: number | null;
  content: string;
  ayat: Ayat[];
  content_preview: string; // first 200 chars
  pasal_references: string[]; // e.g. ["Pasal 59", "Pasal 156"]
}

export interface OcrResult {
  raw_text: string;
  language: string;
  ocr_method: string;
  clauses: Clause[];
  page_count?: number;
}

/**
 * Numeric variables extracted from contract text.
 * Used by both the OCR pipeline (returning values to callers)
 * and the guardrail service (deterministic limit checks).
 */
export interface NumericVariables {
  interest_percent_per_month?: number; // bunga per bulan
  penalty_percent_per_month?: number; // denda / penalti per bulan
  late_interest_percent_per_day?: number; // bunga keterlambatan per hari
  retention_percent?: number; // retensi / potongan jaminan
  dp_percent?: number; // uang muka / DP
  penalty_lump_sum_idr?: number; // denda nominal (Rp)
  pkwt_duration_years?: number; // durasi PKWT dalam tahun
}

// Indonesian OCR Correction Map

/**
 * Apply common Indonesian-language OCR corrections.
 *
 * Priority order matters: more specific patterns first.
 *
 * Corrections address:
 *  1. Pasal-prefix corruption (Pa5al, Pa$al, Pas@l …)
 *  2. Common OCR character confusions in Indonesian legal vocab
 *  3. Whitespace / punctuation normalisation
 */
export function applyOcrCorrections(text: string): string {
  let t = text;

  // Legal term prefix fixes (must come first)
  // Pasal corruption: Pa5al, Pa$al, Pas@l, PasaI (capital-I for l)
  t = t.replace(/Pa[s5$][a@]l\b/gi, "Pasal");
  t = t.replace(/\bPasaI\b/g, "Pasal"); // capital-I suffix

  // Ayat corruption
  t = t.replace(/\bAya[t7]\b/gi, "Ayat");

  // BAB corruption
  t = t.replace(/\bB[A4][B8]\b/gi, "BAB");

  // Character-level confusions
  // "rn" → "m" in Indonesian words (common sans-serif OCR error)
  // Only inside word boundaries so we don't break "international", "internet" etc.
  t = t.replace(/\b(\w*)rn(\w*)\b/g, (_m, pre, suf) => {
    // Apply only when the result forms a plausible Indonesian token
    const candidate = pre + "m" + suf;
    const indonesianTrigrams = [
      "mem",
      "pem",
      "mer",
      "per",
      "diam",
      "umum",
      "kam",
      "jam",
      "mam",
    ];
    if (indonesianTrigrams.some((tri) => candidate.includes(tri))) {
      return candidate;
    }
    return _m;
  });

  // "vv" → "w" (double-v confusion)
  t = t.replace(/vv/gi, "w");

  // "0" (digit zero) mixed into all-alpha Indonesian words
  // e.g. "p0k0k" → "pokok", "kontr0l" → "kontrol"
  t = t.replace(/\b([a-zA-Z]+)0([a-zA-Z]+)\b/g, "$1o$2");

  // "I" (capital-I) alone inside lowercase words → "l"
  // e.g. "perjanIian" → "perjanjian"
  t = t.replace(/([a-z])I([a-z])/g, "$1l$2");

  // "1" (digit one) inside alpha tokens → "l"
  // e.g. "perjan1ian" → "perjanjian"
  t = t.replace(/([a-zA-Z])1([a-zA-Z])/g, "$1l$2");

  // "l" (lowercase-l) as standalone digit: not safe to blanket-replace,
  // but fix common Indonesian word patterns
  // "pasa1" → "pasal", "ayat1" → "ayat1" (number so leave), "denda1" leave
  t = t.replace(/\bpasa1\b/gi, "pasal");
  t = t.replace(/\bpasa1\s+(\d)/gi, "pasal $1");

  // Spacing normalisation
  // Multiple spaces → single space
  t = t.replace(/[ \t]{2,}/g, " ");

  // Stray newlines in middle of sentences (single \n surrounded by lowercase)
  t = t.replace(/([a-z,;])\n([a-z])/g, "$1 $2");

  // Common Indonesian legal vocab normalisation
  t = t.replace(/\bsebagaimana\b/gi, "sebagaimana");
  t = t.replace(/\bperjanjian\b/gi, "perjanjian");
  t = t.replace(/\bwanprestasi\b/gi, "wanprestasi");
  t = t.replace(/\bsomasi\b/gi, "somasi");
  t = t.replace(/\bpkwt\b/gi, "PKWT");
  t = t.replace(/\bpkwtt\b/gi, "PKWTT");
  t = t.replace(/\bkuhperdata\b/gi, "KUHPerdata");
  t = t.replace(/\bkuhdagang\b/gi, "KUHDagang");

  return t.trim();
}

// Numeric Variable Extraction

/**
 * Extract all numeric contract variables from raw text.
 * This is the single source of truth — used by both the OCR pipeline
 * and the guardrail service (which imports this directly).
 */
export function extractNumericVariables(text: string): NumericVariables {
  const result: NumericVariables = {};

  // Interest rate per month: "bunga 3% per bulan" / "bunga 3 persen/bulan"
  const interestMatch = text.match(
    /bunga\s+(\d+(?:[.,]\d+)?)\s*(?:%|persen)\s*(?:per\s+bulan|\/bulan|perbulan)/i,
  );
  if (interestMatch)
    result.interest_percent_per_month = parseFloat(interestMatch[1].replace(",", "."));

  // Penalty rate per month: "denda 10% per bulan"
  const penaltyMatch = text.match(
    /(?:denda|penalti|penalty)\s+(\d+(?:[.,]\d+)?)\s*(?:%|persen)\s*(?:per\s+bulan|\/bulan|perbulan)/i,
  );
  if (penaltyMatch)
    result.penalty_percent_per_month = parseFloat(penaltyMatch[1].replace(",", "."));

  // Late-payment interest per day: "bunga keterlambatan 0,5% per hari"
  const lateDayMatch = text.match(
    /bunga\s+keterlambatan\s+(\d+(?:[.,]\d+)?)\s*(?:%|persen)\s*(?:per\s+hari|\/hari|perhari)/i,
  );
  if (lateDayMatch)
    result.late_interest_percent_per_day = parseFloat(lateDayMatch[1].replace(",", "."));

  // Retention / withholding: "retensi 5%" / "potongan jaminan 5%"
  const retentionMatch = text.match(
    /(?:retensi|potongan\s+jaminan)\s+(?:sebesar\s+)?(\d+(?:[.,]\d+)?)\s*(?:%|persen)/i,
  );
  if (retentionMatch)
    result.retention_percent = parseFloat(retentionMatch[1].replace(",", "."));

  // Down payment: "uang muka 30%" / "DP 30%"
  const dpMatch = text.match(
    /(?:uang\s+muka|down\s+payment|DP)\s+(?:sebesar\s+)?(\d+(?:[.,]\d+)?)\s*(?:%|persen)/i,
  );
  if (dpMatch) result.dp_percent = parseFloat(dpMatch[1].replace(",", "."));

  // Lump-sum penalty (nominal IDR): "denda sebesar Rp 50.000.000" / "denda Rp50juta"
  const lumpSumMatch = text.match(
    /(?:denda|penalti)\s+(?:sebesar\s+)?Rp\.?\s*([\d.,]+)(?:\s*(?:juta|ribu))?/i,
  );
  if (lumpSumMatch) {
    let raw = lumpSumMatch[1].replace(/\./g, "").replace(",", ".");
    const multiplierText = lumpSumMatch[0].toLowerCase();
    let value = parseFloat(raw);
    if (multiplierText.includes("juta")) value *= 1_000_000;
    else if (multiplierText.includes("ribu")) value *= 1_000;
    result.penalty_lump_sum_idr = value;
  }

  // PKWT duration: "PKWT selama 3 tahun" / "PKWT 36 bulan"
  const pkwtYearMatch = text.match(/PKWT\s+selama\s+(\d+)\s+tahun/i);
  if (pkwtYearMatch) result.pkwt_duration_years = parseInt(pkwtYearMatch[1], 10);

  const pkwtMonthMatch = text.match(/PKWT\s+selama\s+(\d+)\s+bulan/i);
  if (pkwtMonthMatch) result.pkwt_duration_years = parseInt(pkwtMonthMatch[1], 10) / 12;

  return result;
}

// Image OCR

export async function extractTextFromImage(
  buffer: Buffer,
  mimeType = "image/jpeg",
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });
  const result = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: mimeType as string,
      },
    },
    "Extract all text in this image verbatim. Maintain the structure of articles, paragraphs, and headings. Do not add any comments or explanations, only the text visible in the document.",
  ]);
  const text = result.response.text().trim();
  if (!text) {
    throw new Error("OCR returned no text for the provided image.");
  }
  return text;
}

// PDF OCR

export interface PdfExtraction {
  text: string;
  method: "pdf-parse" | "gemini";
  pageCount: number | null;
}

export async function extractTextFromPdf(buffer: Buffer): Promise<PdfExtraction> {
  let text = "";
  let pageCount: number | null = null;

  try {
    const pdf = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await pdf.getText();
    text = result.text || "";
    pageCount = typeof result.total === "number" ? result.total : null;
    await pdf.destroy();
  } catch (err) {
    console.warn("[OCR] pdf-parse error:", err);
  }

  // Local extraction succeeded.
  if (text && text.trim().length > 0) {
    return { text, method: "pdf-parse", pageCount };
  }

  // Fallback to Gemini only if pdf-parse fails to extract text.
  console.warn("[OCR] pdf-parse returned empty text; falling back to Gemini...");
  const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL });
  const result = await model.generateContent([
    {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType: "application/pdf",
      },
    },
    "Extract all text in this PDF document verbatim, maintain the structure of articles, paragraphs, and headings. Do not add any comments. Output format: raw text only.",
  ]);
  text = result.response.text().trim();

  if (!text) {
    throw new Error("OCR returned no text for the provided PDF.");
  }
  return { text, method: "gemini", pageCount: null };
}

// Clause Segmentation

// Structural headers ONLY — note: no bare "N." and no "Ayat N" here.
const STRUCTURAL_HEADER =
  /^(BAB\s+[IVXLCDM\d]+|BAGIAN\s+\w+|KLAUSULA\s+\d+|PASAL\s+\d+)\b/i;
const PASAL_HEADER = /^PASAL\s+(\d+)\b/i;
// Ayat line inside a Pasal: "1. ...", "(1) ...", "Ayat (1) ..."
const AYAT_LINE = /^(?:Ayat\s+)?\(?(\d+)\)?[.)]\s+(.*)$/i;

/**
 * Split raw OCR text into structured contract clauses.
 * Segments on Pasal-level structural headers only (BAB, BAGIAN, KLAUSULA, PASAL),
 * never on numbered ayat lines — so "5. ..." inside Pasal 2 is never mistaken
 * for the start of Pasal 5. Ayat are parsed and attached to their parent Pasal.
 */
export function segmentClauses(rawText: string): Clause[] {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const segments: { header: string; pasal: number | null; body: string[] }[] = [];
  let current: { header: string; pasal: number | null; body: string[] } | null = null;

  for (const line of lines) {
    if (STRUCTURAL_HEADER.test(line)) {
      if (current) segments.push(current);
      const m = line.match(PASAL_HEADER);
      current = { header: line, pasal: m ? parseInt(m[1], 10) : null, body: [] };
    } else {
      if (!current) current = { header: "Pembukaan", pasal: null, body: [] };
      current.body.push(line);
    }
  }
  if (current) segments.push(current);
  if (segments.length === 0) {
    segments.push({ header: "Teks Kontrak", pasal: null, body: [rawText] });
  }

  return segments.map((seg, idx) => {
    // First non-ayat body line(s) before the first ayat = the title.
    const firstAyatIdx = seg.body.findIndex((l) => AYAT_LINE.test(l));
    const titleLines = firstAyatIdx === -1 ? seg.body : seg.body.slice(0, firstAyatIdx);
    const title = titleLines.join(" ").trim() || seg.header;

    const ayat: Ayat[] = [];
    for (const l of seg.body) {
      const m = l.match(AYAT_LINE);
      if (m) ayat.push({ number: parseInt(m[1], 10), text: m[2].trim() });
    }

    const content = seg.body.join("\n").trim();
    const pasalMatches = content.match(/Pasal\s+\d+/gi) ?? [];
    return {
      index: idx + 1,
      header: seg.header,
      title,
      pasal_number: seg.pasal,
      content,
      ayat,
      content_preview: content.slice(0, 200) + (content.length > 200 ? "…" : ""),
      pasal_references: [...new Set(pasalMatches)],
    };
  });
}

// Combined pipeline

export async function processUploadedFile(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrResult> {
  let rawText: string;
  let ocrMethod: string;
  let pageCount: number | undefined;

  if (mimeType === "application/pdf") {
    const ext = await extractTextFromPdf(buffer);
    rawText = ext.text;
    ocrMethod = ext.method;
    pageCount = ext.pageCount ?? undefined;
  } else if (mimeType.startsWith("image/")) {
    rawText = await extractTextFromImage(buffer, mimeType);
    ocrMethod = "gemini";
    pageCount = undefined;
  } else {
    throw new Error(`Unsupported MIME type for OCR: ${mimeType}`);
  }

  // Apply Indonesian OCR corrections
  rawText = applyOcrCorrections(rawText);

  const clauses = segmentClauses(rawText);

  return {
    raw_text: rawText,
    language: "en",
    ocr_method: ocrMethod,
    clauses,
    page_count: pageCount,
  };
}

import { axiosInstance } from "../lib/axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Normalize citations from the contract review API into the shape that
 * CitationList in ChatBubble expects: { title, text? }
 *
 * Backend shape: { reference: string, source: string }
 */
const normalizeCitations = (raw = []) =>
  raw.map((c) => {
    if (typeof c === "string") return { title: c };
    if (c.title || c.name) return c;
    return {
      title: c.reference ?? c.source ?? "Source",
      text: c.source !== c.reference ? c.source : undefined,
    };
  });

/**
 * reviewContract — Two-phase review pipeline:
 *
 * Phase 1  POST /api/v1/contract/review   (multipart with file)
 *   → OCR: returns { document_id, raw_text, clauses, extracted_variables }
 *     NOTE: when a file is uploaded the backend returns OCR data only,
 *           NOT the AI reasoning. Reasoning requires a second call.
 *
 * Phase 2  POST /api/v1/contract/validate  (JSON)
 *   → Guardrail + AI reasoning: returns { answer, confidence, citations }
 *
 * @param {{ file: File, question: string }} payload
 * @returns {Promise<{ content, confidenceScore, citations, label, rationale }>}
 */
export const reviewContract = async ({ file, question }) => {
  // ── Phase 1: OCR ─────────────────────────────────────────────────────────
  const formData = new FormData();
  formData.append("file", file);
  if (question) formData.append("question", question);

  console.log("[reviewService] Phase 1 – POST /api/v1/contract/review →", {
    file: file.name,
    question,
  });

  const phase1Response = await axiosInstance.post("contract/review", formData, {
    headers: { ...getAuthHeader() },
    // NOTE: do NOT set Content-Type manually for FormData
  });

  console.log("[reviewService] Phase 1 raw response:", phase1Response.data);

  const phase1Data = phase1Response.data?.data ?? phase1Response.data;

  const documentId = phase1Data?.document_id;
  const rawText = phase1Data?.raw_text ?? "";
  const extractedVariables = phase1Data?.corrected_variables ?? {};

  if (!rawText) {
    throw new Error(
      "OCR gagal: tidak ada teks yang dapat diekstrak dari file.",
    );
  }

  // ── Phase 2: Guardrail + AI reasoning ────────────────────────────────────
  console.log("[reviewService] Phase 2 – POST /api/v1/contract/validate →", {
    document_id: documentId,
    question,
  });

  const phase2Response = await axiosInstance.post(
    "contract/validate",
    {
      document_id: documentId,
      question:
        question ||
        "Analisis kontrak ini dan temukan klausula yang berpotensi merugikan.",
      raw_text: rawText,
      corrected_variables: extractedVariables,
    },
    {
      headers: { "Content-Type": "application/json", ...getAuthHeader() },
    },
  );

  console.log("[reviewService] Phase 2 raw response:", phase2Response.data);

  const phase2Data = phase2Response.data?.data ?? phase2Response.data;

  // Content from AI reasoning
  const content =
    phase2Data?.answer ??
    phase2Data?.content ??
    phase2Data?.response ??
    "Maaf, analisis tidak dapat diselesaikan. Silakan coba lagi.";

  // Confidence score — nested object { score, level, rationale } or flat number
  const rawConfidence = phase2Data?.confidence;
  const confidenceScore =
    typeof rawConfidence === "number"
      ? rawConfidence
      : (rawConfidence?.score ?? null);

  const rationale =
    typeof rawConfidence === "object"
      ? (rawConfidence?.rationale ?? null)
      : null;

  // Label derived from confidence level if not explicitly provided
  const rawLabel = phase2Data?.label;
  const confidenceLevel =
    typeof rawConfidence === "object" ? rawConfidence?.level : null;
  const label =
    rawLabel ??
    (confidenceLevel === "GREEN"
      ? "aman"
      : confidenceLevel === "RED"
        ? "berbahaya"
        : null);

  const citations = normalizeCitations(phase2Data?.citations ?? []);

  console.log("[reviewService] Parsed →", {
    confidenceScore,
    label,
    citationCount: citations.length,
  });

  return { content, confidenceScore, citations, label, rationale };
};

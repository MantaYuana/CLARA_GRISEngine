import { axiosInstance } from "../lib/axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * Parse raw drafter response data into structured fields.
 * Returns clean content (the AI's natural language text) separately from
 * structured metadata (status, documentType, etc.) so the UI can render
 * each part with dedicated components instead of emoji-laden markdown strings.
 */
const parseDrafterResponse = (data) => {
  // Try to parse if accidentally returned as a JSON string
  let parsed = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      // Plain text fallback
      return {
        content: data,
        status: null,
        documentType: null,
        documentNumber: null,
        bindingWarning: false,
        clarifyingQuestions: [],
        draft: null,
        pdfBase64: null,
      };
    }
  }

  const status = parsed?.status ?? null;
  const documentType = parsed?.document_type ?? null;
  const documentNumber = parsed?.document_number ?? null;
  const bindingWarning = parsed?.binding_warning ?? false;
  const clarifyingQuestions = parsed?.clarifying_questions ?? [];
  const draft = parsed?.draft ?? null;
  const pdfBase64 = parsed?.pdf_base64 ?? null;

  // Natural language answer from the AI — used as the main bubble text
  const content = parsed?.message ?? parsed?.content ?? parsed?.answer ?? "";

  return {
    content,
    status,
    documentType,
    documentNumber,
    bindingWarning,
    clarifyingQuestions,
    draft,
    pdfBase64,
  };
};

/**
 * drafterChat — POST /api/v1/drafter/chat
 *
 * Sends a message to the agentic document drafter for multi-turn contract drafting.
 *
 * @param {Object} params
 *   @param {string} session_id - unique session identifier for the draft
 *   @param {string} message - user message / clarification / draft request
 *   @param {Array}  history - conversation history (array of { role, content })
 *
 * Returns: { content, status, documentType, bindingWarning, clarifyingQuestions, draft }
 */
export const drafterChat = async ({ session_id, message, history = [] }) => {
  console.log("[drafterService] POST /api/v1/drafter/chat →", {
    session_id,
    message,
    historyLength: history.length,
  });

  const response = await axiosInstance.post(
    "drafter/chat",
    { session_id, message, history },
    { headers: { "Content-Type": "application/json", ...getAuthHeader() } },
  );

  console.log("[drafterService] Raw response:", response);

  const data = response.data.data;

  const {
    content,
    status,
    documentType,
    documentNumber,
    bindingWarning,
    clarifyingQuestions,
    draft,
    pdfBase64,
  } = parseDrafterResponse(data);

  console.log("[drafterService] Parsed →", {
    status,
    documentType,
    documentNumber,
    contentLength: content?.length,
    clarifyingQuestions: clarifyingQuestions.length,
    hasDraft: !!draft,
    hasPdf: !!pdfBase64,
  });

  return {
    content,
    status,
    documentType,
    documentNumber,
    bindingWarning,
    clarifyingQuestions,
    draft,
    pdfBase64,
  };
};

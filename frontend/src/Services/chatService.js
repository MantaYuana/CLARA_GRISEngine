import { axiosInstance } from "../lib/axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const DUMMY_DOCUMENT_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

/**
 * sendMessage — POST /api/v1/query
 *
 * Returns: { content, confidenceScore, citations }
 * - confidenceScore : number 0-1 (or null)
 * - citations       : array of citation objects (or [])
 */
// 1. Tambahkan session_id di parameter
export const sendMessage = async ({
  message,
  fileIds = [],
  mode,
  session_id,
}) => {
  const payload = {
    question: message,
  };

  if (fileIds && fileIds.length > 0) {
    payload.document_id = fileIds[0];
  }

  // 2. Masukkan session_id ke dalam payload jika ada
  if (session_id) {
    payload.session_id = session_id;
  }

  const response = await axiosInstance.post("query", payload, {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
    },
  });

  const data = response.data.data;

  const content =
    data?.answer ??
    data?.content ??
    data?.response ??
    data?.result ??
    data?.message ??
    (typeof data === "string" ? data : JSON.stringify(data));

  const confidenceScore =
    data?.confidence_score ?? data?.confidence ?? data?.score ?? null;

  const citations = data?.citations ?? data?.sources ?? data?.references ?? [];

  return { content, confidenceScore, citations };
};

/**
 * fetchChatHistory — GET /api/v1/query/history/:sessionId
 *
 * Mengambil riwayat percakapan dari backend
 */
export const fetchChatHistory = async (sessionId) => {
  try {
    const response = await axiosInstance.get(`query/history/${sessionId}`, {
      headers: {
        ...getAuthHeader(),
      },
    });

    return response.data.data; // Mengembalikan { session_id, history }
  } catch (error) {
    console.error("Failed to fetch chat history:", error);
    throw error;
  }
};

/**
 * fetchUserSessions — GET /api/v1/query/sessions
 *
 * Mengambil daftar semua sesi chat milik user
 */
export const fetchUserSessions = async () => {
  try {
    const response = await axiosInstance.get("query/sessions", {
      headers: {
        ...getAuthHeader(),
      },
    });

    return response.data.data; 
  } catch (error) {
    console.error("Failed to fetch user sessions:", error);
    throw error;
  }
};

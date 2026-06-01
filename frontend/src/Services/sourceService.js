import { axiosInstance } from "../lib/axios";

/**
 * Returns the Authorization header using the token from localStorage.
 * Same pattern as useAuth.js.
 */
const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * analyzeFile — uploads a file to POST /api/v1/document/analyze
 *
 * Body     : multipart/form-data { file: File }
 * Auth     : Bearer token from localStorage
 * Response : { document_id, ... } — console.logs the full response
 *
 * @param {File} file — browser File object
 * @returns {Promise<{ documentId: string|null, raw: object }>}
 */
export const analyzeFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  console.log("[sourceService] Uploading file for analysis:", file.name);

  // NOTE: Do NOT set Content-Type manually for FormData — let the browser set
  // it with the correct boundary string. Only attach Authorization.
  const response = await axiosInstance.post("document/analyze", formData, {
    headers: {
      ...getAuthHeader(),
    },
  });

  console.log("[sourceService] ✅ Analyze success for:", file.name);
  console.log("[sourceService] Full response:", response.data);

  // Adapt key name to your actual backend response field
  const documentId =
    response.data?.document_id ??
    response.data?.data?.document_id ??
    response.data?.id ??
    response.data?.data?.id ??
    null;

  if (!documentId) {
    console.warn(
      "[sourceService] ⚠️ document_id not found in response. Full data:",
      response.data,
    );
  } else {
    console.log("[sourceService] document_id:", documentId);
  }

  return { documentId, raw: response.data };
};

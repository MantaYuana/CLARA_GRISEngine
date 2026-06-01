import { axiosInstance } from "../lib/axios";

/**
 * Returns the Authorization header using the token from localStorage.
 */
const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/**
 * fetchUserDocuments — GET /api/v1/document/user
 *
 * Retrieves all documents and drafter projects for the current user.
 *
 * Response shape:
 * {
 *   status: "success",
 *   data: [
 *     { id: string, title: string, created_at: string, type: "review" | string }
 *   ]
 * }
 *
 * @returns {Promise<Array<{ id: string, title: string, created_at: string, type: string }>>}
 */
export const fetchUserDocuments = async () => {
  const response = await axiosInstance.get("document/user", {
    headers: getAuthHeader(),
  });

  // Support both { status, data: [...] } and plain array responses
  const raw = response.data;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

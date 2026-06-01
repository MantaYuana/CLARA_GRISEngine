import { useState, useEffect } from "react";
import { fetchUserDocuments } from "../Services/documentService";

/**
 * useUserFiles — fetches all documents uploaded by the current user
 * from GET /api/v1/document/user and maps them to a consistent shape.
 *
 * Returns:
 *  files      : mapped array of { id, name, size, uploadedAt, type }
 *  isLoading  : boolean
 *  error      : string | null
 *  refetch    : () => void  — manually re-trigger the fetch
 */
const useUserFiles = () => {
  const [files, setFiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserDocuments();

      // Map backend shape → UI shape
      // Backend: { id, title, created_at, type, file_size? }
      const mapped = data.map((doc) => ({
        id: doc.id,
        name: doc.title || doc.filename || "Untitled Document",
        size: doc.file_size ? formatBytes(doc.file_size) : null,
        uploadedAt: doc.created_at || new Date().toISOString(),
        type: doc.type || "document",
      }));

      setFiles(mapped);
    } catch (err) {
      console.error("[useUserFiles] Failed to load documents:", err);
      setError("Failed to load your files. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { files, isLoading, error, refetch: load };
};

/**
 * Converts bytes to a human-readable size string (e.g. "2.3 MB").
 */
const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

export default useUserFiles;

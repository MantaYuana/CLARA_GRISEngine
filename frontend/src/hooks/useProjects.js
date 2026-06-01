import { useState, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
// Import fungsi fetch dari chatService (pastikan path-nya benar sesuai project kamu)
import { fetchUserSessions } from "../Services/chatService";
// Biarkan import service lama untuk rename dan delete jika kamu sudah punya API-nya di backend
import { renameProject, deleteProject } from "../Services/projectService";

/**
 * Custom hook to manage project list state, search, creation, rename, and deletion.
 */
const useProjects = () => {
  const [allProjects, setAllProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  // ── Fetch on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        // Memanggil API /query/sessions yang baru
        const data = await fetchUserSessions();

        // Memetakan data dari backend (session_id, preview, dll)
        // ke format yang dibaca oleh UI ProjectCard (id, title, description, dll)
        if (data && Array.isArray(data)) {
          const mappedData = data
            .filter(
              (session) =>
                session.session_id !== "temp_title_gen" &&
                !session.preview
                  ?.toLowerCase()
                  .startsWith("provide a short title"),
            )
            .map((session) => ({
            id: session.session_id,
            title: session.preview || "New Conversation",
            description: "Chat history",
            updatedAt: session.last_updated || new Date().toISOString(),
            sourcesCount: session.sourcesCount || 0,
          }));
          setAllProjects(mappedData);
        }
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // ── Client-side search ──────────────────────────────────────────────────────
  const projects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allProjects;
    return allProjects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [allProjects, searchQuery]);

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    try {
      setIsCreating(true);

      // Karena backend menggunakan session_id secara dinamis saat chat pertama dikirim,
      // kita cukup generate UUID baru di frontend sebagai ID Sesi.
      const newId = uuidv4();
      const newProject = {
        id: newId,
        title: "New Conversation",
        description: "Start a new conversation...",
        updatedAt: new Date().toISOString(),
        sourcesCount: 0,
      };

      // Tambahkan ke state agar langsung muncul di grid (opsional)
      setAllProjects((prev) => [newProject, ...prev]);

      return newProject;
    } catch (error) {
      console.error("Failed to create project:", error);
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  // ── Rename ──────────────────────────────────────────────────────────────────
  const handleRename = async (id, newTitle) => {
    // Optimistic update
    setAllProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, title: newTitle } : p)),
    );
    try {
      // Pastikan endpoint renameProject di backend kamu mensupport penggantian nama berdasarkan session_id
      if (renameProject) await renameProject(id, newTitle);
    } catch (error) {
      console.error("Failed to rename project:", error);
      // TODO: revert optimistic update on failure
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    // Optimistic update
    setAllProjects((prev) => prev.filter((p) => p.id !== id));
    try {
      // Pastikan endpoint deleteProject di backend mensupport penghapusan berdasarkan session_id
      if (deleteProject) await deleteProject(id);
    } catch (error) {
      console.error("Failed to delete project:", error);
      // TODO: revert optimistic update on failure
    }
  };

  return {
    projects,
    allProjects,
    searchQuery,
    setSearchQuery,
    isLoading,
    isCreating,
    handleCreate,
    handleRename,
    handleDelete,
  };
};

export default useProjects;

import { useState, useEffect, useMemo } from "react";
import { fetchProjects, createProject } from "../Services/projectService";
/**
 * Custom hook to manage project list state, search, and creation.
 *
 * Returns:
 *  - projects        : filtered list for rendering
 *  - allProjects     : raw fetched list
 *  - searchQuery     : current search string
 *  - setSearchQuery  : setter for search input
 *  - isLoading       : fetch loading state
 *  - isCreating      : create loading state
 *  - handleCreate    : async function to create a new project
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
        const data = await fetchProjects();
        setAllProjects(data);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);
  // ── Client-side search / filter ─────────────────────────────────────────────
  const projects = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return allProjects;
    return allProjects.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [allProjects, searchQuery]);
  // ── Create new project ──────────────────────────────────────────────────────
  const handleCreate = async (payload = {}) => {
    try {
      setIsCreating(true);
      const newProject = await createProject(payload);
      setAllProjects((prev) => [newProject, ...prev]);
      return newProject; // caller can use the id to navigate
    } catch (error) {
      console.error("Failed to create project:", error);
      throw error;
    } finally {
      setIsCreating(false);
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
  };
};
export default useProjects;

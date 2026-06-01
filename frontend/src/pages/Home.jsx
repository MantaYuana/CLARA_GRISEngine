import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import HomeHero from "../components/ui/HomeHero";
import ProjectToolbar from "../components/ui/ProjectToolbar";
import ProjectsGrid from "../components/ui/ProjectsGrid";
import useProjects from "../hooks/useProjects";

const Home = () => {
  const navigate = useNavigate();

  const {
    projects,
    searchQuery,
    setSearchQuery,
    isLoading,
    isCreating,
    handleCreate,
    handleRename,
    handleDelete,
  } = useProjects();

  const onCreateNew = async () => {
    try {
      const newProject = await handleCreate();
      navigate(`/chat/${newProject.id}`);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-white dark:bg-backgroundBlack font-poppins">
      <Navbar />

      <HomeHero />

      <ProjectToolbar
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onCreate={onCreateNew}
        isCreating={isCreating}
      />

      <ProjectsGrid
        projects={projects}
        isLoading={isLoading}
        searchQuery={searchQuery}
        onCreate={onCreateNew}
        onRename={handleRename}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default Home;

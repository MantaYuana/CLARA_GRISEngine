import ProjectCard from "../ui/ProjectCard";
import ProjectCardSkeleton from "./ProjectCardSkeleton";
import EmptyState from "./EmptyState";

const ProjectsGrid = ({ projects, isLoading, searchQuery, onCreate, onRename, onDelete }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 mt-8 pb-16">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))
        ) : projects.length === 0 ? (
          <EmptyState searchQuery={searchQuery} onCreate={onCreate} />
        ) : (
          projects.map((item) => {
            const mappedProject = {
              id: item.id || item.session_id,
              title: item.title || item.preview || "New Conversation",
              description: item.description || "Chat history",
              sourcesCount: item.sourcesCount || 0,
              updatedAt:
                item.updatedAt || item.last_updated || new Date().toISOString(),
            };

            return (
              <ProjectCard
                key={mappedProject.id}
                project={mappedProject}
                onRename={onRename}
                onDelete={onDelete}
              />
            );
          })
        )}
      </div>
    </div>
  );
};

export default ProjectsGrid;

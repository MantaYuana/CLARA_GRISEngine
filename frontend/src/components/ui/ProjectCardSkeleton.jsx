const ProjectCardSkeleton = () => (
  <div className="flex flex-col gap-3 p-5 rounded-xl dark:bg-surface border border-border animate-pulse">
    <div className="w-9 h-9 rounded-lg bg-gray-300 dark:bg-surfaceLight" />
    <div className="flex flex-col gap-2">
      <div className="h-3.5 w-3/4 rounded-full bg-gray-300 dark:bg-surfaceLight" />
      <div className="h-3 w-full rounded-full bg-gray-300 dark:bg-surfaceLight" />
      <div className="h-3 w-2/3 rounded-full bg-gray-300 dark:bg-surfaceLight" />
    </div>
    <div className="flex justify-between mt-auto pt-2 border-t border-border/60">
      <div className="h-3 w-16 rounded-full bg-gray-300 dark:bg-surfaceLight" />
      <div className="h-3 w-20 rounded-full bg-gray-300 dark:bg-surfaceLight" />
    </div>
  </div>
);

export default ProjectCardSkeleton;

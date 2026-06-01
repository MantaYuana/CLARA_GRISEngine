const FileCardSkeleton = () => {
  return (
    <div className="flex items-center gap-4 p-5 rounded-xl dark:bg-surface border border-border animate-pulse">
      <div className="w-9 h-9 rounded-lg bg-gray-300 dark:bg-surfaceLight" />

      <div className="flex flex-col gap-2 flex-1">
        <div className="h-3 w-3/4 rounded-full bg-gray-300 dark:bg-surfaceLight" />
        <div className="h-3 w-1/2 rounded-full bg-gray-300 dark:bg-surfaceLight" />
      </div>
    </div>
  );
};

export default FileCardSkeleton;

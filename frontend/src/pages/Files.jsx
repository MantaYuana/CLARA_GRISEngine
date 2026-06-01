import Navbar from "../components/layout/Navbar";
import FilesHero from "../components/ui/FilesHero";
import FilesGrid from "../components/ui/FilesGrid";
import FilesEmpty from "../components/ui/FilesEmpty";
import useUserFiles from "../hooks/useUserFiles";

const Files = () => {
  const { files, isLoading, error, refetch } = useUserFiles();

  return (
    <div className="min-h-screen dark:bg-backgroundBlack flex flex-col">
      <Navbar />

      <div className="flex-1 flex justify-center">
        <div className="max-w-3xl w-full px-4">
          <FilesHero />

          {error ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={refetch}
                className="px-4 py-2 text-sm rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : isLoading ? (
            <FilesGrid isLoading />
          ) : files.length > 0 ? (
            <FilesGrid files={files} />
          ) : (
            <FilesEmpty />
          )}
        </div>
      </div>
    </div>
  );
};

export default Files;


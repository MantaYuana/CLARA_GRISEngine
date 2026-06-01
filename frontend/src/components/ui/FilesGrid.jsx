import FileCard from "./FileCard";
import FileCardSkeleton from "./FileCardSkeleton";

const FilesGrid = ({ files = [], isLoading = false }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-16">
      {isLoading
        ? Array.from({ length: 6 }).map((_, i) => <FileCardSkeleton key={i} />)
        : files.map((file) => <FileCard key={file.id} file={file} />)}
    </div>
  );
};

export default FilesGrid;

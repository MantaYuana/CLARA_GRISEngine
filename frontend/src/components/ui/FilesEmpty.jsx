import { HiOutlineFolder } from "react-icons/hi";

const FilesEmpty = () => {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fadeIn">
      <HiOutlineFolder className="text-5xl text-textSecondary mb-4" />
      <h2 className="text-xl font-semibold text-textPrimary mb-2">
        No Files Yet
      </h2>
      <p className="text-sm text-textSecondary">
        Your uploaded files will appear here.
      </p>
    </div>
  );
};

export default FilesEmpty;

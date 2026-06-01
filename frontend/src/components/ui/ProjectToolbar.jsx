import { HiOutlinePlus } from "react-icons/hi2";
import SearchBar from "../ui/SearchBar";

const ProjectToolbar = ({
  searchQuery,
  setSearchQuery,
  onCreate,
  isCreating,
}) => {
  return (
    <div className="max-w-3xl mx-auto px-4 flex items-center gap-3">
      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search projects..."
      />

      <button
        onClick={onCreate}
        disabled={isCreating}
        className="flex items-center cursor-pointer gap-2 px-5 py-3 rounded-xl text-sm font-semibold
                   bg-primary text-white whitespace-nowrap
                   hover:bg-primary/80 active:scale-95
                   disabled:opacity-60 disabled:cursor-not-allowed
                   transition-all duration-200 shadow-lg shadow-primary/30"
      >
        <HiOutlinePlus className="text-base" />
        {isCreating ? "Creating..." : "Create New"}
      </button>
    </div>
  );
};

export default ProjectToolbar;

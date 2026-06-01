import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
/**
 * SearchBar component.
 *
 * Props:
 *  @param {string}   value       - current search string
 *  @param {Function} onChange    - setter for search string
 *  @param {string}   [placeholder]
 */
const SearchBar = ({ value, onChange, placeholder = "Search projects..." }) => {
  return (
    <div className="relative flex-1">
      <HiOutlineMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-textSecondary text-base pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full dark:bg-surface border border-border rounded-xl
                   pl-11 pr-4 py-3 text-sm text-textPrimary placeholder-textSecondary
                   outline-none transition-all duration-200
                   focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
};
export default SearchBar;

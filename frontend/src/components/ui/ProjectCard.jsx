import { useState, useRef, useEffect } from "react";
import {
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineEllipsisVertical,
  HiOutlinePencil,
  HiOutlineTrash,
} from "react-icons/hi2";
import { HiOutlineDocument } from "react-icons/hi";
import { useNavigate } from "react-router-dom";

/**
 * Formats an ISO date string into a relative time label (e.g. "2 jam lalu").
 */
const formatRelativeTime = (isoString) => {
  const now = Date.now();
  const diff = now - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 60) return `${minutes} menit lalu`;
  if (hours < 24) return `${hours} jam lalu`;
  return `${days} hari lalu`;
};

/**
 * ProjectCard component.
 *
 * Props:
 *  @param {Object}   project
 *  @param {Function} onRename - (id, newTitle) => void
 *  @param {Function} onDelete - (id) => void
 */
const ProjectCard = ({ project, onRename, onDelete }) => {
  const navigate = useNavigate();
  const { id, title, description, sourcesCount, updatedAt } = project;

  // ── 3-dot menu state ──────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // ── Inline rename state ───────────────────────────────────────────────────
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(title);
  const inputRef = useRef(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-focus rename input
  useEffect(() => {
    if (isRenaming) inputRef.current?.focus();
  }, [isRenaming]);

  const handleMenuOpen = (e) => {
    e.stopPropagation(); // prevent card click / navigate
    setMenuOpen((prev) => !prev);
  };

  const handleRenameClick = (e) => {
    e.stopPropagation();
    setRenameValue(title);
    setIsRenaming(true);
    setMenuOpen(false);
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== title) {
      onRename?.(id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setIsRenaming(false);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setMenuOpen(false);
    onDelete?.(id);
  };

  return (
    <div
      onClick={() => !isRenaming && navigate(`/chat/${id}`)}
      className="group relative flex flex-col gap-3 p-5 rounded-xl 
      bg-white dark:bg-surface 
      border border-gray-400 dark:border-border
      cursor-pointer transition-all duration-200
      hover:border-primary/40 
      hover:bg-gray-100 dark:hover:bg-surfaceLight 
      hover:shadow-lg hover:shadow-primary/5
      animate-fadeIn"
    >
      {/* Document icon */}
      <div
        className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center
                       group-hover:bg-primary/25 transition-colors duration-200"
      >
        <HiOutlineDocumentText className="text-primary text-lg" />
      </div>

      {/* Title — normal or rename input */}
      <div className="flex flex-col gap-1 pr-6">
        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-backgroundBlack border border-primary/50 rounded-lg
                       px-2 py-1 text-sm text-textPrimary outline-none
                       focus:ring-2 focus:ring-primary/30"
          />
        ) : (
          <h3
            className="dark:text-textPrimary font-semibold text-sm leading-snug
                           dark:group-hover:text-white transition-colors duration-200 line-clamp-2"
          >
            {title}
          </h3>
        )}
        <p className="dark:text-textSecondary text-xs leading-relaxed line-clamp-2">
          {description}
        </p>
      </div>

      {/* ── 3-dot button ──────────────────────────────────────────────────── */}
      <div ref={menuRef} className="absolute top-4 right-4">
        <button
          onClick={handleMenuOpen}
          className="flex items-center cursor-pointer justify-center w-7 h-7 rounded-lg
                     text-textSecondary opacity-0 group-hover:opacity-100
                     hover:bg-background hover:text-textPrimary
                     transition-all duration-150"
          aria-label="Project options"
        >
          <HiOutlineEllipsisVertical className="text-base" />
        </button>

        {/* Context menu */}
        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-border
                       dark:bg-surface bg-white shadow-xl shadow-black/40 z-50 overflow-hidden
                       animate-fadeIn"
          >
            <button
              onClick={handleRenameClick}
              className="w-full flex items-center cursor-pointer gap-3 px-4 py-2.5 text-sm
                         dark:text-textSecondary hover:text-textPrimary hover:bg-surfaceLight
                         transition-colors duration-150"
            >
              <HiOutlinePencil className="text-base shrink-0" />
              Rename
            </button>
            <button
              onClick={handleDeleteClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm
                         text-red-400 hover:text-red-300 hover:bg-red-500/10
                         transition-colors duration-150"
            >
              <HiOutlineTrash className="text-base shrink-0" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Footer meta */}
      <div className="flex items-center justify-start mt-auto pt-2 border-t border-border/60">
        <div className="flex items-center gap-1.5 dark:text-textSecondary text-xs">
          <HiOutlineClock className="text-sm" />
          <span>{formatRelativeTime(updatedAt)}</span>
        </div>
      </div>
    </div>
  );
};

export default ProjectCard;

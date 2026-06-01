import { HiOutlineDocumentText, HiOutlineClock } from "react-icons/hi2";

/**
 * Formats an ISO date string into a relative time label (e.g. "2 hours ago").
 */
const formatRelativeTime = (isoString) => {
  const now = Date.now();
  const diff = now - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hr ago`;
  return `${days} day${days !== 1 ? "s" : ""} ago`;
};

const TYPE_STYLES = {
  review: "bg-blue-500/15 text-blue-400",
  draft: "bg-emerald-500/15 text-emerald-400",
  document: "bg-primary/15 text-primary",
};

const FileCard = ({ file }) => {
  const { name, size, uploadedAt, type = "document" } = file;
  const badgeStyle = TYPE_STYLES[type] ?? TYPE_STYLES.document;

  return (
    <div
      className="group relative flex flex-col gap-3 p-5 rounded-xl 
      bg-white dark:bg-surface 
      border border-gray-400 dark:border-border
      transition-all duration-200
      hover:border-primary/40 
      hover:bg-gray-100 dark:hover:bg-surfaceLight 
      hover:shadow-lg hover:shadow-primary/5
      animate-fadeIn"
    >
      {/* Header row: icon + type badge */}
      <div className="flex items-center justify-between">
        <div
          className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center
                       group-hover:bg-primary/25 transition-colors duration-200"
        >
          <HiOutlineDocumentText className="text-primary text-lg" />
        </div>

        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${badgeStyle}`}
        >
          {type}
        </span>
      </div>

      {/* File name */}
      <div className="flex flex-col gap-0.5 min-w-0">
        <h3 className="font-medium text-sm dark:text-textPrimary line-clamp-2 leading-snug">
          {name}
        </h3>
        {size && (
          <p className="text-xs dark:text-textSecondary">{size}</p>
        )}
      </div>

      {/* Footer: uploaded at */}
      {uploadedAt && (
        <div className="flex items-center gap-1.5 text-xs dark:text-textSecondary mt-auto pt-2 border-t border-border/60">
          <HiOutlineClock className="text-sm shrink-0" />
          <span>{formatRelativeTime(uploadedAt)}</span>
        </div>
      )}
    </div>
  );
};

export default FileCard;


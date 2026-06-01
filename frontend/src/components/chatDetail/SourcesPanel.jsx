import { useState, useEffect, useRef } from "react";
import {
  HiOutlineChevronLeft,
  HiOutlineChevronRight,
  HiOutlineCloudArrowUp,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiOutlineXMark,
  HiOutlineFolder,
  HiOutlineXCircle,
  HiOutlineInformationCircle,
} from "react-icons/hi2";
import { HiOutlineDocumentText } from "react-icons/hi";
import UploadModal from "./UploadModal";
// import { fetchUserDocuments } from "../../Services/documentService";

/**
 * SourcesPanel — left collapsible panel for file management.
 *
 * Props:
 * @param {Array}    sources        — from useSources
 * @param {number}   selectedCount  — currently selected source count
 * @param {Function} onProcessFiles — (files) => void
 * @param {Function} onToggleSelect — (id) => void
 * @param {Function} onRemoveSource — (id) => void
 */
const SourcesPanel = ({
  sources,
  isLoading,
  selectedCount,
  onProcessFiles,
  onToggleSelect,
  onRemoveSource,
  activeMode,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false); // State for the Guidelines Popup
  const isDraftMode = activeMode === "draft";

  const [recentlyReadyIds, setRecentlyReadyIds] = useState([]);
  const prevSourcesRef = useRef(sources);

  useEffect(() => {
    const newReadyIds = [];

    sources.forEach((s) => {
      const prev = prevSourcesRef.current.find((p) => p.id === s.id);
      if (s.status === "ready" && (!prev || prev.status !== "ready")) {
        newReadyIds.push(s.id);
      }
    });

    if (newReadyIds.length > 0) {
      setRecentlyReadyIds((prev) => [...prev, ...newReadyIds]);

      newReadyIds.forEach((id) => {
        setTimeout(() => {
          setRecentlyReadyIds((prev) => prev.filter((pId) => pId !== id));
        }, 3000);
      });

      const latestReadyId = newReadyIds[newReadyIds.length - 1];
      const sourceToSelect = sources.find((s) => s.id === latestReadyId);

      if (sourceToSelect && !sourceToSelect.selected) {
        onToggleSelect(latestReadyId);
      }
    }

    prevSourcesRef.current = sources;
  }, [sources, onToggleSelect]);

  const renderStatusIcon = (source) => {
    if (source.status === "analyzing") {
      return (
        <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin block shrink-0" />
      );
    }

    if (source.status === "error") {
      return (
        <HiOutlineExclamationCircle className="text-red-400 text-base shrink-0" />
      );
    }

    if (source.selected || recentlyReadyIds.includes(source.id)) {
      return (
        <HiOutlineCheckCircle className="text-green-400 text-base shrink-0 transition-opacity duration-300" />
      );
    }

    return (
      <div className="w-4 h-4 rounded-full border-[1.5px] border-gray-400 dark:border-gray-500 shrink-0 transition-opacity duration-300" />
    );
  };

  return (
    <>
      <div
        className={`flex flex-col shadow-md bg-white dark:bg-background border border-gray-200 dark:border-border rounded-2xl overflow-hidden
                    transition-all duration-300 shrink-0 h-full
                    ${collapsed ? "w-12" : "w-full lg:w-80"}`}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-border shrink-0">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <span className="text-gray-800 dark:text-textPrimary text-sm font-semibold">
                Upload File
              </span>
              {sources.length > 0 && !isDraftMode && (
                <div className="flex items-center gap-1 text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                  <HiOutlineDocumentText className="text-primary text-xs" />
                  <span className="text-primary font-medium">
                    {sources.length} source{sources.length > 1 ? "s" : ""}
                  </span>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setCollapsed((p) => !p)}
            className="ml-auto p-1.5 rounded-lg cursor-pointer dark:text-textSecondary dark:hover:text-textPrimary hover:bg-gray-200 dark:hover:bg-surfaceLight transition-colors"
            aria-label={collapsed ? "Expand panel" : "Collapse panel"}
          >
            {collapsed ? (
              <HiOutlineChevronRight className="text-base" />
            ) : (
              <HiOutlineChevronLeft className="text-base" />
            )}
          </button>
        </div>

        {/* ── Content (hidden when collapsed) ───────────────────────────── */}
        {collapsed ? (
          // Icon strip
          <div className="flex flex-col items-center py-3 gap-3">
            <button
              onClick={() => setModalOpen(true)}
              className="p-2 rounded-lg text-black dark:text-textSecondary hover:text-primary hover:bg-surface transition-colors"
              title="Upload File"
            >
              <HiOutlineCloudArrowUp className="text-xl" />
            </button>
            {sources.length > 0 && (
              <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <span className="dark:text-white text-[10px] font-bold">
                  {sources.length}
                </span>
              </div>
            )}
            <button
              className="p-2 rounded-lg text-black dark:text-textSecondary hover:text-primary hover:bg-surface transition-colors"
              title="My Documents"
            >
              <HiOutlineFolder className="text-xl" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 gap-3 p-3 overflow-y-auto">
            {/* Upload button */}
            <button
              onClick={() => !isDraftMode && setModalOpen(true)}
              disabled={isDraftMode}
              title={
                isDraftMode
                  ? "Upload not available in Create Contract mode"
                  : undefined
              }
              className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl
                          border border-dashed text-sm
                          transition-all duration-200
                          ${
                            isDraftMode
                              ? "border-border/30 text-textSecondary/30 cursor-not-allowed opacity-50"
                              : "border-border cursor-pointer dark:text-textSecondary hover:border-primary/50 hover:text-primary hover:bg-primary/5"
                          }`}
            >
              <HiOutlineCloudArrowUp className="text-base" />
              Upload File
            </button>

            {/* Draft mode: disabled overlay message */}
            {isDraftMode && (
              <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-[11px] text-yellow-400/80 text-center leading-snug">
                  Files cannot be selected while Create Contract mode is active.
                </p>
              </div>
            )}

            {/* File list & Empty State */}
            {isLoading ? (
              <div className="flex flex-col gap-2 mt-4 px-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse flex items-center gap-3 w-full h-11 bg-gray-100 dark:bg-surfaceLight rounded-lg">
                    <div className="w-9 h-9 bg-gray-200 dark:bg-surface rounded-lg shrink-0 ml-1"></div>
                    <div className="flex flex-col gap-1 flex-1 pr-2">
                      <div className="h-2.5 w-3/4 bg-gray-200 dark:bg-surface rounded-full"></div>
                      <div className="h-2 w-1/2 bg-gray-200 dark:bg-surface rounded-full"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : sources.length === 0 ? (
              <div className="flex flex-col items-center mt-6 px-2 text-center">
                <p className="text-textSecondary text-xs mb-3">
                  No files yet. Upload a contract to get started.
                </p>
                <button
                  onClick={() => setGuidelinesOpen(true)}
                  className="flex cursor-pointer items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-medium transition-colors"
                >
                  <HiOutlineInformationCircle className="text-sm" />
                  What files does Clara accept?
                </button>
              </div>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {sources.map((s) => (
                  <li
                    key={s.id}
                    onClick={() =>
                      !isDraftMode &&
                      s.status === "ready" &&
                      onToggleSelect(s.id)
                    }
                    className={`group flex items-center gap-2 px-2.5 py-2 rounded-lg
                                transition-all duration-150
                                ${
                                  isDraftMode
                                    ? "opacity-40 cursor-not-allowed"
                                    : s.selected
                                      ? "bg-primary/15 border border-primary/30 cursor-pointer"
                                      : "dark:hover:bg-surface hover:bg-gray-200 border-surface border cursor-pointer"
                                }
                                ${!isDraftMode && s.status !== "ready" ? "cursor-default" : ""}`}
                  >
                    {renderStatusIcon(s)}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center">
                        <div className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center">
                          <HiOutlineDocumentText className="text-primary text-lg" />
                        </div>

                        <div className="flex flex-col flex-1 min-w-0 ml-2 gap-0.5">
                          <p
                            className={`text-xs font-medium truncate ${
                              s.selected && !isDraftMode
                                ? "text-primary"
                                : "dark:text-textPrimary text-gray-800"
                            }`}
                          >
                            {s.name}
                          </p>
                          {s.status === "analyzing" && (
                            <p className="dark:text-textSecondary text-[10px] truncate">
                              Analyzing...
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {s.status !== "analyzing" && !isDraftMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSource(s.id);
                        }}
                        className="p-0.5 opacity-0 group-hover:opacity-100 dark:text-textSecondary hover:text-red-400 transition-all"
                      >
                        <HiOutlineXMark className="text-sm" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Upload modal */}
      <UploadModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onUpload={(files) => onProcessFiles(files)}
      />

      {/* ── File Guidelines Modal ─────────────────────────────────────── */}
      {guidelinesOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-background border border-gray-200 dark:border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col scale-100">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-border bg-gray-50 dark:bg-surfaceLight">
              <h3 className="font-semibold text-gray-900 dark:text-textPrimary flex items-center gap-2">
                <HiOutlineInformationCircle className="text-primary text-xl" />
                Upload Guidelines
              </h3>
              <button
                onClick={() => setGuidelinesOpen(false)}
                className="text-gray-500 hover:text-gray-800 dark:text-textSecondary dark:hover:text-textPrimary transition-colors p-1"
              >
                <HiOutlineXMark className="text-xl" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 flex flex-col gap-6">
              <p className="text-sm text-gray-600 dark:text-textSecondary leading-relaxed">
                To ensure Clara provides the most accurate analysis and
                insights, please make sure your documents meet the following
                criteria:
              </p>

              <div className="flex flex-col gap-4">
                {/* Do's */}
                <div className="p-4 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 rounded-xl">
                  <h4 className="text-sm font-semibold text-green-800 dark:text-green-400 mb-3 flex items-center gap-2">
                    <HiOutlineCheckCircle className="text-lg" />
                    Supported & Recommended
                  </h4>
                  <ul className="text-sm text-green-700 dark:text-green-300/80 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                      PDF files (.pdf) with standard text.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                      Clear, machine-readable text (native digital PDFs or
                      high-quality OCR).
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 bg-green-500 rounded-full shrink-0" />
                      Standard legal contracts, agreements, or clauses.
                    </li>
                  </ul>
                </div>

                {/* Don'ts */}
                <div className="p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-xl">
                  <h4 className="text-sm font-semibold text-red-800 dark:text-red-400 mb-3 flex items-center gap-2">
                    <HiOutlineXCircle className="text-lg" />
                    Not Supported
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-300/80 space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                      Handwritten documents or signatures.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                      Photographs of physical papers (e.g., from a phone
                      camera).
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                      Blurry, skewed, or poorly scanned documents.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />
                      Password-protected or encrypted PDFs.
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-border bg-gray-50 dark:bg-surfaceLight flex justify-end">
              <button
                onClick={() => setGuidelinesOpen(false)}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SourcesPanel;

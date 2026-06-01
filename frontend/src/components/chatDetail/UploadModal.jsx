import { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import {
  HiOutlineXMark,
  HiOutlineCloudArrowUp,
  HiOutlineDocument,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle,
  HiArrowUpTray,
} from "react-icons/hi2";

const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fileSchema = yup.object({
  files: yup
    .mixed()
    .test(
      "required",
      "Please select at least one file",
      (v) => v && v.length > 0,
    ),
});

/**
 * UploadModal — file upload modal with drag & drop.
 *
 * Props:
 *  @param {boolean}  isOpen   — controls visibility
 *  @param {Function} onClose  — close handler
 *  @param {Function} onUpload — (File[]) => void called after validation
 */
const UploadModal = ({ isOpen, onClose, onUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [staged, setStaged] = useState([]); // files staged for upload review
  const fileInputRef = useRef(null);

  const {
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(fileSchema),
  });

  const stageFiles = (fileList) => {
    const arr = Array.from(fileList);
    setStaged(arr);
    setValue("files", arr);
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    stageFiles(e.dataTransfer.files);
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);

  const handleFileInput = (e) => stageFiles(e.target.files);

  const onSubmit = () => {
    if (staged.length === 0) return;
    onUpload(staged);
    reset();
    setStaged([]);
    onClose();
  };

  const removeStaged = (idx) => {
    const updated = staged.filter((_, i) => i !== idx);
    setStaged(updated);
    setValue("files", updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fadeIn">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl shadow-black/60 animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-textPrimary font-semibold text-base">
            Upload Contract
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-textSecondary hover:text-textPrimary hover:bg-surfaceLight transition-colors"
          >
            <HiOutlineXMark className="text-lg" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="p-6 flex flex-col gap-5"
        >
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed
                        py-10 px-6 cursor-pointer transition-all duration-200
                        ${
                          isDragging
                            ? "border-primary bg-primary/10 scale-[1.01]"
                            : "border-border hover:border-primary/50 hover:bg-primary/5"
                        }`}
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <HiOutlineCloudArrowUp
                className={`text-3xl transition-colors ${isDragging ? "text-primary" : "text-textSecondary"}`}
              />
            </div>
            <div className="text-center">
              <p className="text-textPrimary text-sm font-medium">
                {isDragging ? "Drop files here" : "Drag & drop files here"}
              </p>
              <p className="text-textSecondary text-xs mt-1">
                or{" "}
                <span className="text-primary font-medium">
                  click to select files
                </span>
              </p>
              <p className="text-textSecondary/60 text-xs mt-2">
                PDF, DOCX — 10MB/file, unlimited uploads
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* Staged files list */}
          {staged.length > 0 && (
            <ul className="flex flex-col gap-2">
              {staged.map((f, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-backgroundBlack border border-border"
                >
                  <HiOutlineDocument className="text-primary text-xl shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-textPrimary text-xs font-medium truncate">
                      {f.name}
                    </p>
                    <p className="text-textSecondary text-xs">
                      {formatBytes(f.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStaged(idx)}
                    className="p-1 text-textSecondary hover:text-red-400 transition-colors"
                  >
                    <HiOutlineXMark className="text-sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Error from yup */}
          {errors.files && (
            <p className="text-red-400 text-xs text-center">
              {errors.files.message}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-textSecondary text-sm
                         hover:text-textPrimary hover:bg-surface transition-colors duration-150"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={staged.length === 0}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-medium
                         flex items-center justify-center gap-2
                         hover:bg-primary/80 active:scale-95
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-all duration-150"
            >
              <HiArrowUpTray className="text-base" />
              Upload {staged.length > 0 ? `(${staged.length})` : ""}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;

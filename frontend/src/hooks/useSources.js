import { useState } from "react";
import * as yup from "yup";
import toast from "react-hot-toast";
import { analyzeFile } from "../Services/sourceService";

const MAX_SELECTED = 1; // max files that can be checked/selected simultaneously
const MAX_NAME_DISPLAY = 30; // max chars shown in toast messages

/** Truncates a filename to MAX_NAME_DISPLAY chars with ellipsis */
const truncateName = (name) =>
  name.length > MAX_NAME_DISPLAY
    ? `${name.slice(0, MAX_NAME_DISPLAY)}…`
    : name;
const MAX_SIZE_MB = 10; // max size per file (10 MB)

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Yup schema — validates per-file type & size (no total-count limit)
const fileArraySchema = yup.array().of(
  yup
    .mixed()
    .test("fileSize", `File size must not exceed ${MAX_SIZE_MB}MB`, (f) =>
      f ? f.size <= MAX_SIZE_MB * 1024 * 1024 : true,
    )
    .test("fileType", "Unsupported format. Please use PDF or DOCX", (f) =>
      f ? ACCEPTED_TYPES.includes(f.type) : true,
    ),
);

/**
 * useSources — manages uploaded/analyzed file sources.
 *
 * Rules:
 *  - Upload  : unlimited files (no total count cap)
 *  - Select  : at most MAX_SELECTED (5) files active at once
 *  - Validate: each file ≤ 10 MB, only PDF/DOC/DOCX accepted
 *
 * Returns:
 *  sources         : all source objects
 *  selectedCount   : number of currently selected sources
 *  processFiles    : (FileList|File[]) => void
 *  toggleSelect    : (id) => void  — blocked when 5 already selected
 *  removeSource    : (id) => void
 */
const useSources = () => {
  const [sources, setSources] = useState([]);

  const selectedCount = sources.filter((s) => s.selected).length;

  const processFiles = async (fileList) => {
    const incoming = Array.from(fileList);

    // Validate per-file type and size
    try {
      await fileArraySchema.validate(incoming);
    } catch (err) {
      toast.error(err.message);
      return;
    }

    // Optimistically add files in 'analyzing' state
    const pending = incoming.map((f) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: f.name,
      size: f.size,
      file: f,
      status: "analyzing", // 'analyzing' | 'ready' | 'error'
      selected: false,
    }));

    setSources((prev) => [...prev, ...pending]);

    // Analyze each file sequentially
    for (const item of pending) {
      try {
        const { documentId } = await analyzeFile(item.file);
        setSources((prev) =>
          prev.map((s) =>
            s.id === item.id
              ? { ...s, status: "ready", documentId: documentId ?? null }
              : s,
          ),
        );
        localStorage.setItem("lastDocumentId", documentId);
        console.log(
          `[useSources] "${item.name}" analyzed successfully, documentId: ${documentId}`,
        );
        toast.success(`"${truncateName(item.name)}" analyzed successfully`);
      } catch (err) {
        console.error(
          "[useSources] Analyze error:",
          err?.response?.data ?? err.message,
        );
        setSources((prev) =>
          prev.map((s) => (s.id === item.id ? { ...s, status: "error" } : s)),
        );
        toast.error(`Failed to analyze "${truncateName(item.name)}"`);
      }
    }
  };

  const toggleSelect = (id) => {
    setSources((prev) => {
      const clicked = prev.find((s) => s.id === id);
      const isAlreadySelected = clicked?.selected;

      return prev.map((s) => {
        if (s.id === id && s.status === "ready") {
          return { ...s, selected: !isAlreadySelected };
        }
        return { ...s, selected: false };
      });
    });
  };

  const removeSource = (id) =>
    setSources((prev) => prev.filter((s) => s.id !== id));

  return { sources, selectedCount, processFiles, toggleSelect, removeSource };
};

export default useSources;

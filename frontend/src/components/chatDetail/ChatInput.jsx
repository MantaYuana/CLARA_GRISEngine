import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { HiPaperAirplane, HiOutlineDocumentText } from "react-icons/hi2";

const schema = yup.object({
  message: yup
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message is too long")
    .required(),
});

/**
 * ChatInput — fixed-bottom input inside the chat panel.
 *
 * Props:
 *  @param {Function} onSend        — (message: string) => void
 *  @param {boolean}  isLoading     — disables input while AI is responding
 *  @param {number}   selectedCount — number of selected sources
 *  @param {string|null} activeMode — current mode ('review' | 'draft' | null)
 */
const ChatInput = ({ onSend, isLoading, selectedCount = 0, activeMode }) => {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  const textareaRef = useRef(null);
  const value = watch("message", "");

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    }
  }, [value]);

  const onSubmit = ({ message }) => {
    onSend(message.trim());
    reset();
  };

  // Submit on Enter (Shift+Enter for new line)
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(onSubmit)();
    }
  };

  const canSend = value.trim().length > 0 && !isLoading;

  return (
    <div className="shrink-0 border-t border-gray-200 dark:border-border bg-white dark:bg-background px-4 py-3">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex items-center gap-3 bg-gray-50 dark:bg-surface border border-gray-200 dark:border-border rounded-2xl px-4 py-3
                   focus-within:border-primary/50 transition-colors duration-200"
      >
        {/* Textarea */}
        <textarea
          {...register("message")}
          ref={(el) => {
            register("message").ref(el);
            textareaRef.current = el;
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            activeMode === "review"
              ? "Ask your contract review question..."
              : activeMode === "draft"
                ? "Can you help me draft a contract for [YOUR CONTRACT TYPE]"
                : "Start typing..."
          }
          rows={1}
          disabled={isLoading}
          className="flex-1   bg-transparent dark:text-textPrimary text-sm placeholder-textSecondary
                     outline-none resize-none leading-relaxed max-h-28
                     disabled:opacity-50"
        />

        {/* Send button */}
        <button
          type="submit"
          disabled={!canSend}
          className="p-2 rounded-xl bg-primary text-white
                     hover:bg-primary/80 active:scale-95
                     disabled:opacity-30 disabled:cursor-not-allowed
                     transition-all duration-150 shrink-0"
        >
          <HiPaperAirplane className="text-base" />
        </button>
      </form>

      {/* Review mode hint */}
      {activeMode === "review" && selectedCount === 0 && (
        <p className="text-center text-xs text-yellow-400/70 mt-1.5">
          ⚠️ Review mode: select one file from Sources panel first.
        </p>
      )}
      {activeMode === "review" && selectedCount > 0 && (
        <p className="text-center text-xs text-green-400/70 mt-1.5">
          ✓ {selectedCount} file selected — ready for contract review.
        </p>
      )}

      {/* Disclaimer */}
      <p className="text-center text-xs text-textSecondary dark:text-textSecondary/50 mt-2">
        CLARA AI can be inaccurate. Please double check its responses.
      </p>
    </div>
  );
};

export default ChatInput;

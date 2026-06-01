import ReactMarkdown from "react-markdown";
import {
  HiOutlineSparkles,
  HiOutlineShieldCheck,
  HiOutlineShieldExclamation,
  HiOutlineCheckCircle,
  HiOutlineQuestionMarkCircle,
  HiOutlineExclamationCircle,
} from "react-icons/hi2";
import {
  HiOutlineExternalLink,
  HiOutlineDocumentText,
  HiOutlineDocumentDuplicate,
} from "react-icons/hi";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Format bytes → human-readable size */
const formatSize = (bytes) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Returns color classes based on confidence score (0–1).
 * ≥ 0.75 → green (High), 0.45–0.74 → yellow (Medium), < 0.45 → red (Low)
 */
const getScoreStyle = (score) => {
  if (score === null || score === undefined) return null;
  const pct = Math.round(score * 100);
  if (score >= 0.75)
    return {
      pct,
      label: "High Confidence",
      bar: "bg-green-500",
      text: "text-green-400",
      border: "border-green-500/30",
      bg: "bg-green-500/10",
      dot: "bg-green-400",
    };
  if (score >= 0.45)
    return {
      pct,
      label: "Medium Confidence",
      bar: "bg-yellow-500",
      text: "text-yellow-400",
      border: "border-yellow-500/30",
      bg: "bg-yellow-500/10",
      dot: "bg-yellow-400",
    };
  return {
    pct,
    label: "Low Confidence",
    bar: "bg-red-500",
    text: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/10",
    dot: "bg-red-400",
  };
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** File attachment chip shown on user bubble (review mode) */
const AttachmentChip = ({ attachment }) => {
  if (!attachment) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/20 max-w-fit">
      <HiOutlineDocumentText className="dark:text-white/80 text-base shrink-0" />
      <div className="flex flex-col min-w-0">
        <span className="text-xs dark:text-white font-medium truncate max-w-45">
          {attachment.name}
        </span>
        {attachment.size && (
          <span className="text-[10px] dark:text-white/60">
            {formatSize(attachment.size)}
          </span>
        )}
      </div>
    </div>
  );
};

/** Contract assessment badge: aman / berbahaya */
const LabelBadge = ({ label }) => {
  if (!label) return null;
  const isSafe = label.toLowerCase() === "aman";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold
                  ${
                    isSafe
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-red-500/10 border-red-500/30 text-red-400"
                  }`}
    >
      {isSafe ? (
        <HiOutlineShieldCheck className="text-base shrink-0" />
      ) : (
        <HiOutlineShieldExclamation className="text-base shrink-0" />
      )}
      Contract Assessment: <span className="uppercase ml-1">{label}</span>
    </div>
  );
};

/** Confidence progress bar */
const ConfidenceBar = ({ score }) => {
  const style = getScoreStyle(score);
  if (!style) return null;
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${style.border} ${style.bg}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
      <span className={`text-xs font-medium ${style.text}`}>{style.label}</span>
      <div className="flex-1 h-1.5 rounded-full dark:bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
          style={{ width: `${style.pct}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums ${style.text}`}>
        {style.pct}%
      </span>
    </div>
  );
};

/** Source citations list */
const CitationList = ({ citations }) => {
  if (!citations || citations.length === 0) return null;
  return (
    <div className="mt-3 pt-3 border-t border-border/60">
      <p className="text-[10px] uppercase tracking-widest dark:text-textSecondary/60 font-semibold mb-2">
        Sources
      </p>
      <div className="flex flex-col gap-1.5">
        {citations.map((cite, idx) => {
          const isObj = typeof cite === "object" && cite !== null;
          const title = isObj
            ? (cite.title ?? cite.name ?? cite.text ?? `Source ${idx + 1}`)
            : cite;
          const url = isObj ? (cite.url ?? cite.link ?? null) : null;
          const page = isObj ? (cite.page ?? cite.page_number ?? null) : null;
          const subtitle = isObj ? (cite.text ?? cite.source ?? null) : null;

          return (
            <div
              key={idx}
              className="flex items-start gap-2 px-2.5 py-2 rounded-lg dark:bg-backgroundBlack/60 border border-border/40
                         hover:border-primary/30 transition-colors duration-150"
            >
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary/20 text-primary text-[9px] font-bold shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="dark:text-textSecondary text-xs leading-snug truncate">
                  {title}
                </p>
                {subtitle && subtitle !== title && (
                  <p className="dark:text-textSecondary/50 text-gray-600 text-[10px] mt-0.5 truncate">
                    {subtitle}
                  </p>
                )}
                {page && (
                  <p className="dark:text-textSecondary/50 text-[10px] mt-0.5">
                    Page {page}
                  </p>
                )}
              </div>
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dark:text-textSecondary/50 hover:text-primary transition-colors shrink-0"
                >
                  <HiOutlineExternalLink className="text-sm" />
                </a>
              ) : (
                <HiOutlineDocumentText className="dark:text-textSecondary/30 text-sm shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Draft mode — status/doc-type/binding warning badge */
const DraftStatusBadge = ({ status, documentType, bindingWarning }) => {
  if (!status) return null;
  const isReady = status === "draft_ready";
  const isClarify = status === "needs_clarification";
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold
          ${
            isReady
              ? "bg-green-500/10 border-green-500/30 text-green-400"
              : isClarify
                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                : "bg-primary/10 border-primary/30 text-primary"
          }`}
      >
        {isReady ? (
          <HiOutlineCheckCircle className="text-base shrink-0" />
        ) : (
          <HiOutlineQuestionMarkCircle className="text-base shrink-0" />
        )}
        {isReady ? "Draft Ready" : isClarify ? "Needs Clarification" : status}
        {documentType && (
          <span className="ml-auto font-medium opacity-80">{documentType}</span>
        )}
      </div>
      {bindingWarning && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs">
          <HiOutlineExclamationCircle className="text-base shrink-0" />
          This contract has binding clauses — further review required.
        </div>
      )}
    </div>
  );
};

/** Draft mode — numbered clarifying questions with ? icon */
const ClarifyingQuestionsList = ({ questions }) => {
  if (!questions || questions.length === 0) return null;
  return (
    <div className="mt-1 pt-3 border-t border-border/60">
      <p className="text-[10px] uppercase tracking-widest dark:text-textSecondary/60 font-semibold mb-2">
        Clarification Questions
      </p>
      <div className="flex flex-col gap-2">
        {questions.map((q, idx) => (
          <div
            key={idx}
            className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-backgroundBlack/60 border border-border/40"
          >
            {/* Question mark icon instead of number */}
            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500/20 border border-yellow-500/30 shrink-0 mt-0.5">
              <HiOutlineQuestionMarkCircle className="text-yellow-400 text-xs" />
            </div>
            <p className="dark:text-textPrimary text-sm leading-snug">
              {stripMarkdown(q)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Strip common markdown symbols so draft text looks like plain document text */
const stripMarkdown = (text) => {
  if (!text) return "";
  return (
    text
      // Remove bold/italic: **text** or *text*
      .replace(/\*{1,3}([^*]+)\*{1,3}/g, "$1")
      // Remove heading hashes: ## Title → Title
      .replace(/^#{1,6}\s+/gm, "")
      // Remove horizontal rules
      .replace(/^-{3,}\s*$/gm, "────────────────────────────")
      // Remove remaining lone asterisks/underscores at line boundaries
      .replace(/^\s*[\*\-]\s/gm, "  • ")
      .trim()
  );
};

/** Open base64 PDF in a new browser tab */
const openPdf = (base64) => {
  try {
    const byteString = atob(base64);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.error("[ChatBubble] Failed to open PDF:", e);
  }
};

/** Draft mode — final contract draft as plain text with optional PDF button */
const DraftContent = ({ draft, pdfBase64, documentNumber }) => {
  if (!draft) return null;
  const plainText = stripMarkdown(draft);

  return (
    <div className="mt-1 pt-3 border-t border-border/60">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <HiOutlineDocumentDuplicate className="text-primary text-sm" />
          <p className="text-[10px] uppercase tracking-widest dark:text-textSecondary/60 font-semibold">
            Contract Draft{documentNumber ? ` · ${documentNumber}` : ""}
          </p>
        </div>

        {/* PDF preview button */}
        {pdfBase64 && (
          <button
            onClick={() => openPdf(pdfBase64)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-primary/20 hover:bg-primary/30 border border-primary/40
                       text-primary text-xs font-medium
                       transition-all duration-150 active:scale-95"
          >
            <HiOutlineExternalLink className="text-sm" />
            View PDF
          </button>
        )}
      </div>

      {/* Draft plain text */}
      <div className="rounded-xl bg-backgroundBlack/60 border border-border/60 p-4 max-h-105 overflow-y-auto">
        <p className="text-sm dark:text-textSecondary leading-relaxed whitespace-pre-wrap font-sans">
          {plainText}
        </p>
      </div>
    </div>
  );
};

// ── Markdown renderer ─────────────────────────────────────────────────────────
const mdComponents = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 text-justify leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold dark:text-textPrimary">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic dark:text-textSecondary">{children}</em>
  ),
  ul: ({ children }) => (
    <ul className="list-disc text-justify list-outside ml-3 space-y-1 my-2 pl-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-disc list-outside list ml-2 space-y-1 my-2 pl-1">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="dark:text-textPrimary text-justify leading-relaxed">{children}</li>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="px-1.5 py-0.5 rounded bg-surfaceLight text-primary text-xs font-mono">
        {children}
      </code>
    ) : (
      <pre className="mt-2 p-3 rounded-xl bg-backgroundBlack border border-border overflow-x-auto">
        <code className="text-xs font-mono text-textSecondary">{children}</code>
      </pre>
    ),
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-textPrimary mt-3 mb-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-sm font-bold text-textPrimary mt-3 mb-1">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-textPrimary mt-2 mb-1">
      {children}
    </h3>
  ),
  hr: () => <hr className="border-border my-3" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-textSecondary italic">
      {children}
    </blockquote>
  ),
};

// ── ChatBubble ────────────────────────────────────────────────────────────────
/**
 * ChatBubble — renders one chat message.
 *
 * message fields:
 *   role               'user' | 'assistant'
 *   content            main text (markdown)
 *   attachment         { name, size } — file attached by user (review mode)
 *   confidenceScore    0–1 (query & review modes)
 *   citations          citation objects (query & review modes)
 *   label              'aman' | 'berbahaya' (review mode)
 *   status             'needs_clarification' | 'draft_ready' (draft mode)
 *   documentType       contract type string (draft mode)
 *   documentNumber     document reference number (draft mode)
 *   bindingWarning     boolean (draft mode)
 *   clarifyingQuestions string[] (draft mode)
 *   draft              string — final draft text (draft mode)
 *   pdfBase64          string — base64 PDF for preview (draft mode)
 */
const ChatBubble = ({ message, user }) => {
  const isUser = message.role === "user";

  const name = user?.name || "User";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // ── User bubble ─────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end px-4 max-w-full">
        <div className="flex items-end gap-2 max-w-[75%]">
          <div className="flex flex-col gap-2 items-end">
            {/* File attachment chip */}
            <AttachmentChip attachment={message.attachment} />

            {/* Message text */}
            <div
              className="px-4 py-3 rounded-2xl shadow-md dark:shadow-none rounded-br-sm text-sm leading-relaxed
                         dark:bg-primary/20 bg-primary text-white dark:text-textPrimary border border-primary/20 whitespace-pre-wrap"
            >
              {message.content}
            </div>
          </div>

          {/* Avatar */}
          <div className="w-7 h-7 rounded-full overflow-hidden ring-2 ring-primary/50 bg-surfaceLight border border-primary dark:border-border flex items-center justify-center shrink-0">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center
                            bg-linear-to-br from-secondary to-primary text-white text-sm font-semibold"
              >
                {initials}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Assistant bubble ─────────────────────────────────────────────────────
  return (
    <div className="flex justify-start px-4">
      <div className="flex items-start gap-2 max-w-[82%]">
        {/* CLARA icon */}
        <div className="w-7 h-7 rounded-full dark:bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
          <HiOutlineSparkles className="text-primary text-sm" />
        </div>

        {/* Bubble */}
        <div
          className="flex flex-col gap-3 px-4 py-3 rounded-2xl rounded-bl-sm
                      dark:bg-surface border dark:shadow-none shadow-md border-primary/20 dark:border-border dark:text-textPrimary min-w-0"
        >
          {/* Review mode: contract label */}
          <LabelBadge label={message.label} />

          {/* Draft mode: status badge */}
          <DraftStatusBadge
            status={message.status}
            documentType={message.documentType}
            bindingWarning={message.bindingWarning}
          />

          {/* Markdown content — strip markdown for draft mode, render markdown for others */}
          {message.content && (
            <div className="text-sm leading-relaxed">
              {message.status ? (
                <p className="leading-relaxed whitespace-pre-wrap">
                  {stripMarkdown(message.content)}
                </p>
              ) : (
                <ReactMarkdown components={mdComponents}>
                  {message.content}
                </ReactMarkdown>
              )}
            </div>
          )}

          {/* Draft mode: clarifying questions */}
          <ClarifyingQuestionsList questions={message.clarifyingQuestions} />

          {/* Draft mode: final draft */}
          <DraftContent
            draft={message.draft}
            pdfBase64={message.pdfBase64}
            documentNumber={message.documentNumber}
          />

          {/* Confidence score bar (query & review modes) */}
          {message.confidenceScore !== null &&
            message.confidenceScore !== undefined && (
              <ConfidenceBar score={message.confidenceScore} />
            )}

          {/* Citations (query & review modes) */}
          <CitationList citations={message.citations} />
        </div>
      </div>
    </div>
  );
};

// ── TypingBubble ──────────────────────────────────────────────────────────────
export const TypingBubble = () => (
  <div className="flex justify-start px-4">
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
        <HiOutlineSparkles className="text-primary text-sm" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm dark:bg-surface border border-border">
        <div className="flex gap-1 items-center">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-textSecondary animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default ChatBubble;

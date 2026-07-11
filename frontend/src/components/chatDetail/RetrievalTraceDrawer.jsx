/**
 * RetrievalTraceDrawer
 *
 * A right-side slide-over drawer that visualises the full retrieval pipeline
 * for a single CLARA response.
 *
 * Props:
 *   open   {boolean}         — whether the drawer is visible
 *   onClose {() => void}     — called when backdrop or X button is clicked
 *   trace  {object|null}     — the trace object (see shape below); may be null
 *
 * Trace shape (all fields are optional / defensive):
 * {
 *   query, mode: "hybrid"|"structural", legs[], fusion{rrfK, items[]}, graph{nodes[], edges[]},
 *   structural{kind, pasalNumber, ayatNumber, matched[], source}, answerMode: "raw"|"natural",
 *   reasoning{paths[], agreement, groundedness, unsupportedClaims[], gated, confidence, confidenceLevel},
 *   contextSource
 * }
 */

import { useState, useEffect } from "react";
import {
  HiOutlineXMark,
  HiOutlineSparkles,
  HiOutlineChevronDown,
  HiOutlineChevronRight,
} from "react-icons/hi2";

import PipelineStepper from "./trace/PipelineStepper.jsx";
import LegScores from "./trace/LegScores.jsx";
import RrfTable from "./trace/RrfTable.jsx";
import TraceGraph from "./trace/TraceGraph.jsx";
import ConfidencePanel from "./trace/ConfidencePanel.jsx";
import StructuralPanel from "./trace/StructuralPanel.jsx";
import JourneyPanel from "./trace/JourneyPanel.jsx";

// ── Section wrapper ────────────────────────────────────────────────────────────
const Section = ({ title, step, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border dark:border-border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 dark:bg-surfaceLight bg-gray-50 hover:dark:bg-surface hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          {step != null && (
            <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {step}
            </span>
          )}
          <span className="text-sm font-semibold dark:text-textPrimary text-gray-800">
            {title}
          </span>
        </div>
        {open ? (
          <HiOutlineChevronDown className="dark:text-textSecondary text-gray-500 text-base shrink-0" />
        ) : (
          <HiOutlineChevronRight className="dark:text-textSecondary text-gray-500 text-base shrink-0" />
        )}
      </button>

      {/* Body */}
      {open && <div className="px-4 py-4 dark:bg-background bg-white">{children}</div>}
    </div>
  );
};

// ── Context source banner ──────────────────────────────────────────────────────
const ContextBanner = ({ contextSource }) => {
  if (!contextSource || contextSource === "retrieval") return null;

  const isRaw = contextSource === "raw_text";
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium
        ${
          isRaw
            ? "dark:bg-yellow-500/10 bg-yellow-50 border-yellow-500/30 dark:text-yellow-400 text-yellow-700"
            : "dark:bg-gray-500/10 bg-gray-50 border-gray-500/30 dark:text-textSecondary text-gray-500"
        }`}
    >
      <HiOutlineSparkles className="text-base shrink-0" />
      {isRaw
        ? "Answer was generated from raw text — retrieval pipeline was not used."
        : "No retrieval context — answer generated without external sources."}
    </div>
  );
};

// ── Main drawer ────────────────────────────────────────────────────────────────
const RetrievalTraceDrawer = ({ open, onClose, trace }) => {
  // Keep hooks at the top regardless of early-return conditions
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Animate in/out
  useEffect(() => {
    if (open && trace) {
      setMounted(true);
      // Give the DOM a frame to register the element before transitioning
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [open, trace]);

  // Trap Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Gate: nothing to render
  if (!mounted || !trace) return null;

  const {
    query = "",
    mode = "hybrid",
    legs = [],
    fusion,
    graph,
    reasoning,
    structural,
    journey,
    answerMode,
    contextSource,
  } = trace;

  const isRetrievalMode = !contextSource || contextSource === "retrieval";
  const isStructural = mode === "structural";

  return (
    <>
      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      />

      {/* ── Drawer panel ──────────────────────────────────────────────────── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Retrieval trace"
        className="fixed inset-y-0 right-0 z-50 flex flex-col
                   dark:bg-background bg-white
                   shadow-2xl
                   transition-transform duration-300 ease-in-out"
        style={{
          width: "min(900px, 95vw)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-5 py-4 border-b dark:border-border border-gray-200 shrink-0 dark:bg-surfaceLight bg-gray-50">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl dark:bg-primary/20 bg-primary/10 border border-primary/30 flex items-center justify-center shrink-0 mt-0.5">
              <HiOutlineSparkles className="text-primary text-base" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold dark:text-textPrimary text-gray-900">
                How I got this answer
              </h2>
              {query && (
                <p
                  className="text-xs dark:text-textSecondary text-gray-500 mt-0.5 truncate max-w-[580px]"
                  title={query}
                >
                  {query}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close trace drawer"
            className="p-1.5 rounded-lg cursor-pointer dark:text-textSecondary dark:hover:text-textPrimary text-gray-500 hover:text-gray-800 hover:bg-gray-200 dark:hover:bg-surfaceLight transition-colors shrink-0 ml-3"
          >
            <HiOutlineXMark className="text-lg" />
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 p-5">
            {/* Context source banner (only if not normal retrieval) */}
            <ContextBanner contextSource={contextSource} />

            {isStructural ? (
              <>
                {/* ── Structural mode: deterministic retrieval journey ── */}
                <Section title="Retrieval Journey" step={1} defaultOpen>
                  {journey ? (
                    <JourneyPanel journey={journey} />
                  ) : (
                    <StructuralPanel structural={structural} answerMode={answerMode} />
                  )}
                </Section>

                {reasoning && (
                  <Section title="Confidence & Reasoning" step={2} defaultOpen>
                    <ConfidencePanel reasoning={reasoning} />
                  </Section>
                )}
              </>
            ) : (
              <>
                {/* ── Section 1: Pipeline stepper ───────────────────────────── */}
                <Section title="Retrieval Pipeline" step={null} defaultOpen>
                  <PipelineStepper />
                </Section>

                {/* ── Section 2: Per-leg scores ─────────────────────────────── */}
                <Section title="Per-Leg Scores" step={1} defaultOpen={isRetrievalMode}>
                  <LegScores legs={legs} />
                </Section>

                {/* ── Section 3: RRF fusion table ──────────────────────────── */}
                <Section title="RRF Fusion" step={2} defaultOpen={isRetrievalMode}>
                  <RrfTable fusion={fusion} legs={legs} />
                </Section>

                {/* ── Section 4: Knowledge graph ───────────────────────────── */}
                <Section title="Knowledge Graph" step={3} defaultOpen={isRetrievalMode}>
                  <TraceGraph graph={graph} fusion={fusion} query={query} />
                </Section>

                {/* ── Section 5: Confidence ────────────────────────────────── */}
                <Section title="Confidence & Reasoning" step={4} defaultOpen>
                  <ConfidencePanel reasoning={reasoning} />
                </Section>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="shrink-0 px-5 py-3 border-t dark:border-border border-gray-200 dark:bg-surfaceLight bg-gray-50 flex items-center justify-between">
          <p className="text-[10px] dark:text-textSecondary/50 text-gray-400 uppercase tracking-widest font-semibold">
            CLARA · GRIS Engine Trace
          </p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs dark:text-textSecondary text-gray-500 dark:hover:text-textPrimary hover:text-gray-800 dark:hover:bg-surface hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <HiOutlineXMark className="text-sm" />
            Close
          </button>
        </div>
      </div>
    </>
  );
};

export default RetrievalTraceDrawer;

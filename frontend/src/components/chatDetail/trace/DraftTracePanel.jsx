import { HiOutlineCheckCircle, HiOutlineExclamationTriangle, HiOutlineXCircle } from "react-icons/hi2";

const STATUS_ICON = {
  ok: <HiOutlineCheckCircle className="text-green-500 text-sm shrink-0" />,
  warn: <HiOutlineExclamationTriangle className="text-yellow-500 text-sm shrink-0" />,
  error: <HiOutlineXCircle className="text-red-500 text-sm shrink-0" />,
};

const STATUS_BG = {
  ok: "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400",
  warn: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
  error: "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400",
};

const STEP_LABELS = {
  classify_intent: "Classify Document Type",
  extract_fields: "Extract Structured Fields",
  completeness_check: "Completeness Assessment",
  fetch_templates: "Fetch Clause Templates",
  assemble_draft: "Assemble Draft Document",
  guardrail: "Guardrail Safety Check",
};

const DraftTracePanel = ({ trace }) => {
  if (!trace) {
    return <p className="text-xs text-gray-400 italic py-2">No draft trace data</p>;
  }

  const {
    steps = [],
    documentType = "—",
    bindingWarning = false,
    extractedFields = {},
    completeness = { score: 0, missingCritical: [] },
    templates = [],
    guardrail,
  } = trace;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {steps.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${STATUS_BG[s.status] ?? STATUS_BG.ok}`}
          >
            {STATUS_ICON[s.status] ?? STATUS_ICON.ok}
            <span className="font-medium">{STEP_LABELS[s.name] ?? s.name}</span>
            {s.detail && <span className="opacity-70">— {s.detail}</span>}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-lg bg-primary/15 text-primary font-semibold">
          {documentType}
        </span>
        {bindingWarning && (
          <span className="px-2 py-1 rounded-lg bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 font-medium">
            ⚠ Binding Warning
          </span>
        )}
      </div>

      {Object.keys(extractedFields).length > 0 && (
        <div className="overflow-hidden rounded-xl border dark:border-border border-gray-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-surfaceLight">
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-textSecondary uppercase tracking-wider">Field</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-textSecondary uppercase tracking-wider">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-border divide-gray-200">
              {Object.entries(extractedFields).map(([key, value]) => (
                <tr key={key} className="hover:bg-gray-50 dark:hover:bg-surfaceLight/40">
                  <td className="px-3 py-1.5 dark:text-textSecondary text-gray-500 font-medium whitespace-nowrap">
                    {key.replace(/_/g, " ")}
                  </td>
                  <td className="px-3 py-1.5 dark:text-textPrimary text-gray-800 break-words max-w-[300px]">
                    {value || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs">
        <span className="text-gray-500 dark:text-textSecondary">Completeness Score:</span>
        <span
          className={`px-2 py-0.5 rounded-md font-semibold ${
            completeness.score >= 0.7
              ? "bg-green-500/15 text-green-600 dark:text-green-400"
              : completeness.score >= 0.4
                ? "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400"
                : "bg-red-500/15 text-red-700 dark:text-red-400"
          }`}
        >
          {(completeness.score * 100).toFixed(0)}%
        </span>
        {completeness.missingCritical?.length > 0 && (
          <span className="text-yellow-600 dark:text-yellow-400">
            Missing: {completeness.missingCritical.join(", ")}
          </span>
        )}
      </div>

      {templates.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
            Clause Templates Used ({templates.length})
          </p>
          <ul className="text-xs dark:text-textPrimary text-gray-800 flex flex-col gap-1">
            {templates.map((t) => (
              <li
                key={t.id}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-surfaceLight/60 flex items-center gap-2"
              >
                <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                  {t.order}
                </span>
                {t.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      {guardrail && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${
            guardrail.is_safe
              ? "bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400"
              : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
          }`}
        >
          {guardrail.is_safe ? <HiOutlineCheckCircle className="text-base shrink-0" /> : <HiOutlineXCircle className="text-base shrink-0" />}
          {guardrail.is_safe ? "Guardrail passed" : "Guardrail flagged issues"}
          {guardrail.warning_count > 0 && ` — ${guardrail.warning_count} warning(s)`}
        </div>
      )}
    </div>
  );
};

export default DraftTracePanel;

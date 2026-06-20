/**
 * ConfidencePanel — reasoning paths, entropy chain, and confidence badge.
 * Props: reasoning: { paths[], entropy, citationBonus, adjustedEntropy, confidence, confidenceLevel }
 */

const LEVEL_STYLES = {
  green: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    text: "text-green-400",
    dot: "bg-green-400",
    badge: "#10b981",
  },
  yellow: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    text: "text-yellow-400",
    dot: "bg-yellow-400",
    badge: "#f59e0b",
  },
  red: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    text: "text-red-400",
    dot: "bg-red-400",
    badge: "#ef4444",
  },
};

const fmt = (n, decimals = 4) => (n != null ? Number(n).toFixed(decimals) : "–");

const ConfidencePanel = ({ reasoning }) => {
  if (!reasoning) {
    return (
      <p className="text-xs dark:text-textSecondary/50 text-gray-400 italic py-2">
        No data for this stage
      </p>
    );
  }

  const {
    paths = [],
    entropy,
    citationBonus,
    adjustedEntropy,
    confidence,
    confidenceLevel = "yellow",
  } = reasoning;

  const level = LEVEL_STYLES[confidenceLevel] ?? LEVEL_STYLES.yellow;
  const confidencePct =
    confidence != null
      ? confidence > 1
        ? Math.round(confidence)
        : Math.round(confidence * 100)
      : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Reasoning paths */}
      {paths.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-widest dark:text-textSecondary/60 text-gray-500 font-semibold">
            Reasoning Paths
          </p>
          <div className="flex flex-col gap-1.5">
            {paths.map((p, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 px-3 py-2 rounded-lg dark:bg-surfaceLight/60 bg-gray-100 border dark:border-border border-gray-200"
              >
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold shrink-0">
                  {(p.index ?? idx) + 1}
                </span>
                <span className="text-xs dark:text-textPrimary text-gray-800">
                  Path {p.index ?? idx + 1}
                </span>
                <span className="text-[11px] dark:text-textSecondary text-gray-500">
                  temp{" "}
                  <span className="font-mono dark:text-textPrimary text-gray-700">
                    {p.temperature?.toFixed(3) ?? "–"}
                  </span>
                </span>
                <span className="text-[11px] dark:text-textSecondary text-gray-500 ml-auto">
                  <span className="font-mono dark:text-textPrimary text-gray-700">
                    {p.citationCount ?? 0}
                  </span>{" "}
                  citation{p.citationCount !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs dark:text-textSecondary/50 text-gray-400 italic">
          No reasoning paths recorded
        </p>
      )}

      {/* Entropy chain */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-widest dark:text-textSecondary/60 text-gray-500 font-semibold">
          Entropy Chain
        </p>
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl dark:bg-surfaceLight bg-gray-100 border dark:border-border border-gray-200">
          <ChainToken
            label="entropy"
            value={fmt(entropy)}
            color="dark:text-textPrimary text-gray-700"
          />
          <span className="dark:text-textSecondary text-gray-400 text-sm font-light">
            −
          </span>
          <ChainToken
            label="citationBonus"
            value={fmt(citationBonus)}
            color="text-green-400"
          />
          <span className="dark:text-textSecondary text-gray-400 text-sm font-light">
            =
          </span>
          <ChainToken
            label="adjustedEntropy"
            value={fmt(adjustedEntropy)}
            color="text-primary"
            highlight
          />
        </div>
      </div>

      {/* Confidence badge */}
      <div
        className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${level.border} ${level.bg}`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${level.dot} animate-pulse`}
        />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wide ${level.text}`}>
            {confidenceLevel === "green"
              ? "High Confidence"
              : confidenceLevel === "yellow"
                ? "Medium Confidence"
                : "Low Confidence"}
          </p>
          {confidencePct != null && (
            <p className={`text-2xl font-bold mt-0.5 font-mono ${level.text}`}>
              {confidencePct}%
            </p>
          )}
        </div>
        {/* Mini progress arc */}
        {confidencePct != null && (
          <div className="w-12 h-12 shrink-0">
            <svg viewBox="0 0 36 36" className="rotate-[-90deg]">
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="3"
              />
              <circle
                cx="18"
                cy="18"
                r="15"
                fill="none"
                stroke={level.badge}
                strokeWidth="3"
                strokeDasharray={`${(confidencePct / 100) * 94.25} 94.25`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};

/** Small label+value token used in the entropy chain row */
const ChainToken = ({ label, value, color, highlight }) => (
  <div
    className={`flex flex-col items-center px-2 py-1 rounded-lg ${
      highlight ? "dark:bg-primary/10 bg-primary/5" : ""
    }`}
  >
    <span className="text-[9px] dark:text-textSecondary/60 text-gray-400 uppercase tracking-wider">
      {label}
    </span>
    <span className={`text-sm font-mono font-semibold ${color}`}>{value}</span>
  </div>
);

export default ConfidencePanel;

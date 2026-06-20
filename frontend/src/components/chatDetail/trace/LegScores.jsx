/**
 * LegScores — per-leg retrieval score columns.
 * Props: legs: Leg[]
 */

export const LEG_COLORS = {
  dense: "#3b82f6",
  bm25: "#f59e0b",
  symbolic: "#10b981",
  contract: "#a855f7",
};

const truncate = (str, max = 48) =>
  str && str.length > max ? str.slice(0, max) + "…" : (str ?? "");

const LegScores = ({ legs }) => {
  if (!legs || legs.length === 0) {
    return (
      <p className="text-xs dark:text-textSecondary/50 text-gray-400 italic py-2">
        No data for this stage
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-3 w-full">
      {legs.map((leg) => {
        const color = LEG_COLORS[leg.name] ?? "#a09aad";
        const items = leg.items ?? [];

        // Max score for normalising bar widths within this leg
        const maxScore = items.reduce((m, it) => Math.max(m, it.score ?? 0), 0) || 1;

        return (
          <div
            key={leg.name}
            className="flex-1 min-w-[200px] rounded-xl border dark:border-border border-gray-200 overflow-hidden"
            style={{ borderTopColor: color, borderTopWidth: 2 }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-3 py-2 dark:bg-surfaceLight bg-gray-100">
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color }}
              >
                {leg.name}
              </span>
              <span className="text-[10px] dark:text-textSecondary text-gray-500 font-mono">
                w={leg.weight?.toFixed(2) ?? "–"}
              </span>
            </div>

            {/* Items */}
            <div className="flex flex-col gap-1.5 p-2">
              {items.length === 0 ? (
                <p className="text-[11px] dark:text-textSecondary/50 text-gray-400 italic py-1 px-1">
                  No data for this stage
                </p>
              ) : (
                items.map((item) => {
                  const barPct = Math.round(((item.score ?? 0) / maxScore) * 100);
                  return (
                    <div key={item.id} className="flex flex-col gap-0.5">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className="text-[11px] dark:text-textPrimary text-gray-800 truncate max-w-[130px]"
                          title={item.title}
                        >
                          #{item.rank} {truncate(item.title, 32)}
                        </span>
                        <span className="text-[10px] dark:text-textSecondary text-gray-500 font-mono shrink-0">
                          {item.score?.toFixed(4) ?? "–"}
                        </span>
                      </div>
                      {/* Score bar */}
                      <div className="h-1 rounded-full dark:bg-white/10 bg-gray-200 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%`, backgroundColor: color }}
                        />
                      </div>
                      <span
                        className="text-[9px] dark:text-textSecondary/60 text-gray-400 truncate"
                        title={item.source}
                      >
                        {truncate(item.source, 30)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LegScores;

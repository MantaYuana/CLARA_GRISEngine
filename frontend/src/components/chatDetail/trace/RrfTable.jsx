/**
 * RrfTable — RRF fusion table.
 * Props: fusion: { rrfK, items[] }, legs: Leg[]
 */
import { LEG_COLORS } from "./LegScores.jsx";

const truncate = (str, max = 52) =>
  str && str.length > max ? str.slice(0, max) + "…" : (str ?? "");

const RrfTable = ({ fusion, legs }) => {
  if (!fusion || !fusion.items || fusion.items.length === 0) {
    return (
      <p className="text-xs dark:text-textSecondary/50 text-gray-400 italic py-2">
        No data for this stage
      </p>
    );
  }

  const rrfK = fusion.rrfK ?? 60;
  const items = [...fusion.items].sort((a, b) => (a.finalRank ?? 0) - (b.finalRank ?? 0));

  // Collect the unique leg names present across all contributions
  const legNames =
    legs && legs.length > 0
      ? legs.map((l) => l.name)
      : [...new Set(items.flatMap((it) => (it.contributions ?? []).map((c) => c.leg)))];

  /**
   * Look up the weighted contribution of a given leg for a given item.
   * Returns a number or null if the item wasn't found by that leg.
   */
  const getContrib = (item, legName) => {
    const c = (item.contributions ?? []).find((c) => c.leg === legName);
    return c ? c.weighted : null;
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Formula */}
      <div className="px-3 py-2 rounded-xl dark:bg-surfaceLight bg-gray-100 border dark:border-border border-gray-200">
        <p className="text-[11px] dark:text-textSecondary text-gray-600 font-mono">
          weighted = 1 / ({rrfK} + rank + 1) × legWeight &nbsp;·&nbsp; rrfK ={" "}
          <span className="dark:text-textPrimary text-gray-800 font-semibold">
            {rrfK}
          </span>
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border dark:border-border border-gray-200">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="dark:bg-surfaceLight bg-gray-100 dark:text-textSecondary text-gray-600">
              <th className="px-2 py-2 text-left font-semibold w-8">#</th>
              <th className="px-2 py-2 text-left font-semibold">Title</th>
              {legNames.map((name) => (
                <th
                  key={name}
                  className="px-2 py-2 text-right font-semibold whitespace-nowrap"
                  style={{ color: LEG_COLORS[name] ?? "#a09aad" }}
                >
                  {name}
                </th>
              ))}
              <th className="px-2 py-2 text-right font-semibold dark:text-textPrimary text-gray-800">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, rowIdx) => (
              <tr
                key={item.id ?? rowIdx}
                className={`border-t dark:border-border border-gray-100 transition-colors
                  ${
                    rowIdx % 2 === 0
                      ? "dark:bg-surface/50 bg-white"
                      : "dark:bg-surfaceLight/30 bg-gray-50"
                  }
                  dark:hover:bg-primary/5 hover:bg-primary/5`}
              >
                <td className="px-2 py-2 dark:text-textSecondary text-gray-500 font-mono">
                  {item.finalRank ?? rowIdx + 1}
                </td>
                <td
                  className="px-2 py-2 dark:text-textPrimary text-gray-800 max-w-[180px]"
                  title={item.title}
                >
                  <span className="truncate block">{truncate(item.title, 40)}</span>
                </td>
                {legNames.map((name) => {
                  const val = getContrib(item, name);
                  return (
                    <td
                      key={name}
                      className="px-2 py-2 text-right font-mono"
                      style={{
                        color: val != null ? (LEG_COLORS[name] ?? "#a09aad") : undefined,
                      }}
                    >
                      {val != null ? (
                        val.toFixed(5)
                      ) : (
                        <span className="dark:text-textSecondary/30 text-gray-300">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-right font-semibold font-mono dark:text-textPrimary text-gray-800">
                  {item.total?.toFixed(5) ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RrfTable;

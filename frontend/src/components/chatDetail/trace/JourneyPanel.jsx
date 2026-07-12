/** JourneyPanel — step-by-step retrieval journey for structural mode. */
import { HiOutlineChevronRight } from "react-icons/hi2";

const JourneyPanel = ({ journey }) => {
  if (!journey || !Array.isArray(journey.steps)) {
    return <p className="text-xs text-gray-400 italic py-2">No journey data</p>;
  }

  const { steps = [], query } = journey;

  return (
    <div className="flex flex-col gap-3">
      {query && (
        <div className="text-xs dark:text-textSecondary text-gray-500">
          Query: <span className="font-mono dark:text-textPrimary text-gray-700">{query}</span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 px-3 py-2 rounded-lg dark:bg-surfaceLight/60 bg-gray-100 border dark:border-border border-gray-200"
          >
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold shrink-0 mt-0.5">
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0 text-xs dark:text-textPrimary text-gray-800">
              {step.action && (
                <span className="font-semibold">{step.action}</span>
              )}
              {step.detail && (
                <span className="dark:text-textSecondary text-gray-500 ml-1">
                  <HiOutlineChevronRight className="inline text-[10px] mr-0.5" />
                  {step.detail}
                </span>
              )}
              {step.result && (
                <div className="mt-1 text-[11px] dark:text-textSecondary/70 text-gray-500">
                  {step.result}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JourneyPanel;

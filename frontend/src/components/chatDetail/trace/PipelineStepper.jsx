/**
 * PipelineStepper — horizontal 5-step progress indicator for the retrieval pipeline.
 */
const STEPS = [
  { number: 1, label: "Retrieve" },
  { number: 2, label: "Fuse" },
  { number: 3, label: "Assemble" },
  { number: 4, label: "Reason" },
  { number: 5, label: "Confidence" },
];

const PipelineStepper = () => {
  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto py-1">
      {STEPS.map((step, idx) => (
        <div key={step.number} className="flex items-center min-w-0">
          {/* Step pill */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 shrink-0">
            <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {step.number}
            </span>
            <span className="text-xs font-medium dark:text-textPrimary text-gray-800 whitespace-nowrap">
              {step.label}
            </span>
          </div>
          {/* Arrow connector */}
          {idx < STEPS.length - 1 && (
            <div className="flex items-center px-1 shrink-0">
              <svg
                width="16"
                height="12"
                viewBox="0 0 16 12"
                fill="none"
                className="dark:text-textSecondary/40 text-gray-400"
              >
                <path
                  d="M1 6h12M9 2l4 4-4 4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default PipelineStepper;

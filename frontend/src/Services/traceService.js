/** Normalize/guard a raw trace object from the API. Returns the trace or null. */
export const normalizeTrace = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  // backend already emits the camelCase shape the drawer expects;
  // default `mode` so older trace payloads (pre-structural-routing) still branch correctly.
  return { mode: raw.mode ?? "hybrid", ...raw };
};

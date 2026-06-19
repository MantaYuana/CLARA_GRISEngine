/** Normalize/guard a raw trace object from the API. Returns the trace or null. */
export const normalizeTrace = (raw) => {
  if (!raw || typeof raw !== "object") return null;
  return raw; // backend already emits the camelCase shape the drawer expects
};

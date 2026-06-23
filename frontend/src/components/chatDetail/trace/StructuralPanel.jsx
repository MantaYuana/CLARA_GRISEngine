/** StructuralPanel — deterministic Pasal-lookup trace (no legs/RRF/graph). */

const KIND_LABEL = { count: "Hitung Pasal", fetch: "Ambil Pasal", list: "Daftar Pasal" };

const StructuralPanel = ({ structural, answerMode }) => {
  if (!structural) {
    return <p className="text-xs text-gray-400 italic py-2">No structural data</p>;
  }

  const { kind, pasalNumber, ayatNumber, matched = [], source } = structural;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-lg bg-primary/15 text-primary font-semibold">
          {KIND_LABEL[kind] ?? kind}
        </span>
        {pasalNumber != null && (
          <span className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-surfaceLight">
            Pasal {pasalNumber}
            {ayatNumber != null ? ` ayat ${ayatNumber}` : ""}
          </span>
        )}
        <span className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-surfaceLight">
          Sumber: {source}
        </span>
        <span className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-surfaceLight">
          Mode: {answerMode ?? "raw"}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
          Matched
        </p>
        {matched.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Tidak ada yang cocok</p>
        ) : (
          <ul className="text-xs dark:text-textPrimary text-gray-800 flex flex-col gap-1">
            {matched.map((m, i) => (
              <li
                key={i}
                className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-surfaceLight/60"
              >
                Pasal {m.pasal_number} — {m.title}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="px-3 py-2 rounded-lg border border-green-500/30 bg-green-500/10 text-green-400 text-xs">
        ✓ Dijawab langsung dari struktur dokumen — tanpa tebakan model
        {answerMode === "natural" ? " (diparafrasekan)" : ""}.
      </div>
    </div>
  );
};

export default StructuralPanel;

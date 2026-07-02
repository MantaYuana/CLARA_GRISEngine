import { getSession } from "../../config/neo4j";
import type { RoutedQuestion } from "./intentRouter";
import type { StructuralKind, TraceJourney } from "./retrievalTrace";

function toNum(v: unknown): number {
  const maybe = v as { toNumber?: () => number } | null | undefined;
  return maybe?.toNumber?.() ?? Number(v ?? 0);
}

function ayatCountOf(ayatJson: unknown): number {
  if (!ayatJson || typeof ayatJson !== "string") return 0;
  try {
    const arr = JSON.parse(ayatJson);
    return Array.isArray(arr) ? arr.length : 0;
  } catch {
    return 0;
  }
}

function kindShort(k: RoutedQuestion["kind"]): StructuralKind {
  if (k === "structural_count") return "count";
  if (k === "structural_list") return "list";
  return "fetch";
}

function buildCypher(routed: RoutedQuestion): string {
  if (routed.kind === "structural_count")
    return "MATCH (cc:ContractClause { document_id }) WHERE cc.pasal_number IS NOT NULL\nRETURN count(DISTINCT cc.pasal_number)";
  if (routed.kind === "structural_list")
    return "MATCH (cc:ContractClause { document_id }) WHERE cc.pasal_number IS NOT NULL\nRETURN cc.pasal_number, cc.title ORDER BY cc.pasal_number";
  return `MATCH (cc:ContractClause { document_id, pasal_number: ${routed.pasalNumber} })\nRETURN cc.title, cc.content, cc.ayat_json`;
}

function buildMatchedText(routed: RoutedQuestion): string {
  if (routed.kind === "structural_fetch") {
    const ayat = routed.ayatNumber != null ? ` ayat ${routed.ayatNumber}` : "";
    return `Pasal ${routed.pasalNumber}${ayat}`;
  }
  if (routed.kind === "structural_count") return 'kata kunci: jumlah + "pasal"';
  return 'kata kunci: daftar + "pasal"';
}

export interface BuildJourneyInput {
  documentId: string;
  routed: RoutedQuestion;
  question: string;
  matched: { pasal_number: number; title: string }[];
  found: boolean;
  answerMode: "raw" | "natural";
}

export async function buildStructuralJourney(
  input: BuildJourneyInput,
): Promise<TraceJourney> {
  const { documentId, routed, question, matched, found, answerMode } = input;
  const session = await getSession();
  try {
    const docRes = await session.run(
      `MATCH (d:Document { id: $documentId })
       RETURN d.ocr_method AS ocrMethod, d.page_count AS pageCount, d.raw_text_length AS rawTextLength
       LIMIT 1`,
      { documentId },
    );
    const drec = docRes.records[0];
    const ocrMethod = (drec?.get("ocrMethod") as string) ?? null;
    const pageRaw = drec?.get("pageCount");
    const lenRaw = drec?.get("rawTextLength");
    const pageCount = pageRaw == null ? null : toNum(pageRaw);
    const rawTextLength = lenRaw == null ? null : toNum(lenRaw);

    const listRes = await session.run(
      `MATCH (cc:ContractClause { document_id: $documentId })
       WHERE cc.pasal_number IS NOT NULL
       RETURN cc.pasal_number AS n, cc.title AS title, cc.ayat_json AS ayatJson, size(cc.content) AS charCount
       ORDER BY n ASC`,
      { documentId },
    );
    const pasalList = listRes.records.map((r) => ({
      pasal_number: toNum(r.get("n")),
      title: (r.get("title") as string) ?? "",
      ayatCount: ayatCountOf(r.get("ayatJson")),
      charCount: toNum(r.get("charCount")),
    }));

    return {
      ingestion: {
        ocrMethod,
        pageCount,
        rawTextLength,
        pasalCount: pasalList.length,
        pasalList,
      },
      retrieval: {
        kind: kindShort(routed.kind),
        question,
        parse: {
          intent: kindShort(routed.kind),
          matchedText: buildMatchedText(routed),
          pasalNumber: routed.pasalNumber,
          ayatNumber: routed.ayatNumber,
        },
        cypher: buildCypher(routed),
        found,
        matched,
        answerMode,
      },
    };
  } finally {
    await session.close();
  }
}

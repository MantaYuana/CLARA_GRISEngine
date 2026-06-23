import { getSession } from "../../config/neo4j";

export interface PasalRecord {
  pasal_number: number;
  title: string;
  content: string;
  ayat: { number: number; text: string }[];
}

export function pickAyat(ayatJson: string | null | undefined, n: number): string | null {
  if (!ayatJson) return null;
  try {
    const arr = JSON.parse(ayatJson) as { number: number; text: string }[];
    return arr.find((a) => a.number === n)?.text ?? null;
  } catch {
    return null;
  }
}

export async function countPasal(documentId: string): Promise<number> {
  const session = await getSession();
  try {
    const r = await session.run(
      `MATCH (cc:ContractClause { document_id: $documentId })
       WHERE cc.pasal_number IS NOT NULL
       RETURN count(DISTINCT cc.pasal_number) AS n`,
      { documentId },
    );
    return r.records[0]?.get("n")?.toNumber?.() ?? Number(r.records[0]?.get("n") ?? 0);
  } finally {
    await session.close();
  }
}

export async function listPasal(
  documentId: string,
): Promise<{ pasal_number: number; title: string }[]> {
  const session = await getSession();
  try {
    const r = await session.run(
      `MATCH (cc:ContractClause { document_id: $documentId })
       WHERE cc.pasal_number IS NOT NULL
       RETURN cc.pasal_number AS n, cc.title AS title
       ORDER BY n ASC`,
      { documentId },
    );
    return r.records.map((rec) => ({
      pasal_number: rec.get("n")?.toNumber?.() ?? Number(rec.get("n")),
      title: (rec.get("title") as string) ?? "",
    }));
  } finally {
    await session.close();
  }
}

export async function fetchPasal(
  documentId: string,
  n: number,
): Promise<PasalRecord | null> {
  const session = await getSession();
  try {
    const r = await session.run(
      `MATCH (cc:ContractClause { document_id: $documentId, pasal_number: $n })
       RETURN cc.title AS title, cc.content AS content, cc.ayat_json AS ayatJson
       LIMIT 1`,
      { documentId, n },
    );
    if (r.records.length === 0) return null;
    const rec = r.records[0];
    let ayat: { number: number; text: string }[] = [];
    try {
      ayat = JSON.parse((rec.get("ayatJson") as string) ?? "[]");
    } catch {
      ayat = [];
    }
    return {
      pasal_number: n,
      title: rec.get("title") as string,
      content: rec.get("content") as string,
      ayat,
    };
  } finally {
    await session.close();
  }
}

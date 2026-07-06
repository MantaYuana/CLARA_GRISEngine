/**
 * bm25Retrieval.ts
 * Full-text (BM25) keyword retrieval over Article and LegalConcept nodes.
 * Falls back to plain CONTAINS when the fulltext index returns no results
 * (e.g. index not yet populated or query not parseable by Lucene).
 */
import { getSession } from "../../config/neo4j";
import neo4j from "neo4j-driver";
import type { RetrievalResult } from "./denseRetrieval";

/**
 * Try fulltext-index BM25 query; returns undefined if the index is missing
 * or the query throws, so the caller can fall through to CONTAINS scan.
 */
async function tryFulltext(
  session: ReturnType<typeof getSession> extends Promise<infer S> ? S : never,
  queryText: string,
  escapedQuery: string,
  topK: number,
): Promise<RetrievalResult[] | undefined> {
  try {
    const result = await session.run(
      `
      CALL db.index.fulltext.queryNodes('article_text_idx', $query)
      YIELD node AS a, score
      WITH a, score
      ORDER BY score DESC
      LIMIT $topK
      RETURN
        a.id            AS id,
        labels(a)[0]    AS label,
        COALESCE(a.number, a.name, a.title, a.id) AS title,
        COALESCE(a.content, a.description, '')     AS content,
        score,
        COALESCE(a.law_id, 'Indonesia Law')        AS source,
        a.law_id                                   AS law_id
      `,
      { query: escapedQuery, topK: neo4j.int(topK) },
    );

    const hits = result.records.map((rec: any) => ({
      id: rec.get("id") as string,
      label: rec.get("label") as RetrievalResult["label"],
      title: rec.get("title") as string,
      content: rec.get("content") as string,
      score: (rec.get("score") as number) / 10,
      source: rec.get("source") as string,
      law_id: rec.get("law_id") as string | undefined,
    }));

    return hits.length > 0 ? hits : undefined;
  } catch (err) {
    console.warn("[bm25] Fulltext query failed, falling back to CONTAINS:", (err as Error).message);
    return undefined;
  }
}

/**
 * Plain Cypher CONTAINS scan — used when the fulltext index is unavailable
 * or returns no results.
 * Breaks the query into individual keywords so that "Apa itu wanprestasi"
 * matches articles containing "wanprestasi" (not just the full phrase).
 */
async function fallbackContains(
  session: any,
  queryText: string,
  topK: number,
): Promise<RetrievalResult[]> {
  const raw = queryText.replace(/[^a-zA-Z0-9\s]/g, "").trim();
  if (raw.length === 0) return [];

  // Split into individual non-empty keywords
  const words = raw.split(/\s+/).filter(Boolean).slice(0, 8);
  if (words.length === 0) return [];

  const result = await session.run(
    `
    MATCH (a)
    WHERE (a:Article OR a:LegalConcept)
      AND ANY(w IN $words WHERE
        toLower(a.content) CONTAINS toLower(w)
        OR toLower(a.title)  CONTAINS toLower(w)
        OR toLower(a.name)   CONTAINS toLower(w)
      )
    RETURN
      a.id            AS id,
      labels(a)[0]    AS label,
      COALESCE(a.number, a.name, a.title, a.id) AS title,
      COALESCE(a.content, a.description, '')     AS content,
      0.5             AS score,
      COALESCE(a.law_id, 'Indonesia Law')        AS source,
      a.law_id                                   AS law_id
    LIMIT $topK
    `,
    { words, topK: neo4j.int(topK) },
  );

  return result.records.map((rec: any) => ({
    id: rec.get("id") as string,
    label: rec.get("label") as RetrievalResult["label"],
    title: rec.get("title") as string,
    content: rec.get("content") as string,
    score: rec.get("score") as number,
    source: rec.get("source") as string,
    law_id: rec.get("law_id") as string | undefined,
  }));
}

/**
 * Clean query text for fulltext search: strip trailing punctuation and special characters
 * that break Lucene query parsing (?, !, ., :, etc.)
 */
function cleanQuery(raw: string): string {
  return raw.replace(/[?!.]+$/g, "").trim().slice(0, 256);
}

export async function bm25Search(
  queryText: string,
  topK = 5,
): Promise<RetrievalResult[]> {
  // Strip trailing punctuation that breaks Lucene (e.g. "Apa itu wanprestasi?" → "Apa itu wanprestasi")
  const cleaned = cleanQuery(queryText);

  // Escape Lucene special characters to prevent query parse errors
  const escapedQuery = cleaned
    .replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&")
    .slice(0, 256);

  const session = await getSession();
  try {
    // 1. Try fulltext index query
    const fulltext = await tryFulltext(session, cleaned, escapedQuery, topK);
    if (fulltext) return fulltext;

    // 2. Fallback: plain CONTAINS scan
    console.log("[bm25] Falling back to CONTAINS scan");
    return await fallbackContains(session, cleaned, topK);
  } finally {
    await session.close();
  }
}

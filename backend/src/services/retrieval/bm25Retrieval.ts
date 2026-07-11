/**
 * bm25Retrieval.ts
 * Full-text (BM25) keyword retrieval over Article and LegalConcept nodes.
 */
import { getSession } from "../../config/neo4j";
import type { RetrievalResult } from "./denseRetrieval";

export async function bm25Search(
  queryText: string,
  topK = 5,
): Promise<RetrievalResult[]> {
  // Escape Lucene special characters to prevent query parse errors
  const escapedQuery = queryText
    .replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&")
    .slice(0, 256); // safety limit

  const session = await getSession();
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
      { query: escapedQuery, topK },
    );

    return result.records.map((rec) => ({
      id: rec.get("id") as string,
      label: rec.get("label") as RetrievalResult["label"],
      title: rec.get("title") as string,
      content: rec.get("content") as string,
      score: (rec.get("score") as number) / 10, // normalise BM25 to ~0–1
      source: rec.get("source") as string,
      law_id: rec.get("law_id") as string | undefined,
    }));
  } finally {
    await session.close();
  }
}

/**
 * denseRetrieval.ts
 * Vector similarity search over Article and LegalConcept nodes in Neo4j.
 */
import { getSession } from "../../config/neo4j";
import { embedText } from "../embedding/embeddingService";
import { TaskType } from "@google/generative-ai";

export interface RetrievalResult {
  id: string;
  label: "Article" | "LegalConcept" | "ContractClause";
  title: string;
  content: string;
  score: number; // cosine similarity 0–1
  source: string; // e.g. "KUHPerdata", "UU-13-2003", "Uploaded Contract"
  law_id?: string;
}

export async function denseSearch(
  queryText: string,
  topK = 5,
): Promise<RetrievalResult[]> {
  const queryEmbedding = await embedText(queryText, TaskType.RETRIEVAL_QUERY);
  const session = await getSession();

  try {
    const result = await session.run(
      `
      CALL db.index.vector.queryNodes('article_embedding_idx', $topK, $embedding)
      YIELD node AS a, score
      RETURN
        a.id            AS id,
        labels(a)[0]    AS label,
        COALESCE(a.number, a.name, a.title, a.id) AS title,
        COALESCE(a.content, a.description, '')     AS content,
        score,
        COALESCE(a.law_id, 'Indonesia Law')        AS source,
        a.law_id                                   AS law_id
      ORDER BY score DESC
      `,
      { topK, embedding: queryEmbedding },
    );

    return result.records.map((rec) => ({
      id: rec.get("id") as string,
      label: rec.get("label") as RetrievalResult["label"],
      title: rec.get("title") as string,
      content: rec.get("content") as string,
      score: rec.get("score") as number,
      source: rec.get("source") as string,
      law_id: rec.get("law_id") as string | undefined,
    }));
  } finally {
    await session.close();
  }
}

/**
 * Embed and store an article / clause node's content embedding.
 * Utility used during data ingestion.
 */
export async function storeEmbedding(
  nodeId: string,
  label: string,
  content: string,
): Promise<void> {
  const embedding = await embedText(content, TaskType.RETRIEVAL_DOCUMENT);
  const session = await getSession();
  try {
    await session.run(`MATCH (n:${label} { id: $nodeId }) SET n.embedding = $embedding`, {
      nodeId,
      embedding,
    });
  } finally {
    await session.close();
  }
}

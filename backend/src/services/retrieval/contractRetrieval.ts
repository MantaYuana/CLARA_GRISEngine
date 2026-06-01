/**
 * contractRetrieval.ts
 * Dense vector search over ContractClause nodes, filtered by document_id.
 * Falls back to a plain Cypher scan if the vector index returns no results
 * (e.g., embeddings were skipped during upload).
 */
import { getSession } from "../../config/neo4j";
import { embedText } from "../embedding/embeddingService";
import { TaskType } from "@google/generative-ai";
import type { RetrievalResult } from "./denseRetrieval";

export async function contractRetrieval(
  queryText: string,
  documentId: string,
  topK = 5,
): Promise<RetrievalResult[]> {
  const session = await getSession();

  try {
    // Strategy 1: Vector similarity search (preferred)
    let vectorResults: RetrievalResult[] = [];
    try {
      const queryEmbedding = await embedText(queryText, TaskType.RETRIEVAL_QUERY);
      const result = await session.run(
        `
        CALL db.index.vector.queryNodes('contract_clause_embedding_idx', $topK, $embedding)
        YIELD node AS cc, score
        WHERE cc.document_id = $documentId
        RETURN
          cc.id         AS id,
          'ContractClause' AS label,
          cc.header     AS title,
          cc.content    AS content,
          score,
          'Uploaded Contract' AS source
        ORDER BY score DESC
        `,
        { topK: topK * 3, embedding: queryEmbedding, documentId },
        // fetch 3x then filter vector index doesn't pre-filter in all Neo4j versions
      );

      vectorResults = result.records.slice(0, topK).map((rec) => ({
        id: rec.get("id") as string,
        label: "ContractClause" as const,
        title: rec.get("title") as string,
        content: rec.get("content") as string,
        score: rec.get("score") as number,
        source: "Uploaded Contract",
      }));
    } catch {
      // Vector index may not exist yet or embeddings are missing use fallback
    }

    if (vectorResults.length > 0) {
      return vectorResults;
    }

    // Strategy 2: Plain scan fallback (when no embeddings are stored)
    console.warn(
      `[contractRetrieval] Vector search returned 0 results for document_id="${documentId}". Falling back to plain scan.`,
    );
    const fallback = await session.run(
      `
      MATCH (cc:ContractClause { document_id: $documentId })
      RETURN
        cc.id      AS id,
        cc.header  AS title,
        cc.content AS content
      ORDER BY cc.index ASC
      LIMIT $topK
      `,
      { documentId, topK },
    );

    if (fallback.records.length === 0) {
      console.warn(
        `[contractRetrieval] No ContractClause nodes found for document_id="${documentId}". ` +
        `Make sure the document was uploaded and stored successfully.`,
      );
    }

    return fallback.records.map((rec) => ({
      id: rec.get("id") as string,
      label: "ContractClause" as const,
      title: rec.get("title") as string,
      content: rec.get("content") as string,
      score: 1.0, // flat score not ranked by similarity
      source: "Uploaded Contract",
    }));
  } finally {
    await session.close();
  }
}

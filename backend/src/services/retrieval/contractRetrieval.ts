import { getSession } from "../../config/neo4j";
import { embedText } from "../embedding/embeddingService";
import type { RetrievalResult } from "./denseRetrieval";

function escapeLucene(q: string): string {
  return q.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&").slice(0, 256);
}

export async function contractRetrieval(
  queryText: string,
  documentId: string,
  topK = 5,
): Promise<RetrievalResult[]> {
  const session = await getSession();
  const byId = new Map<string, RetrievalResult>();

  const add = (r: RetrievalResult) => {
    const existing = byId.get(r.id);
    if (!existing || r.score > existing.score) byId.set(r.id, r);
  };

  try {
    // Leg 1: vector similarity over this document's clauses
    try {
      const queryEmbedding = await embedText(queryText, "query");
      const v = await session.run(
        `CALL db.index.vector.queryNodes('contract_clause_embedding_idx', $k, $embedding)
         YIELD node AS cc, score
         WHERE cc.document_id = $documentId
         RETURN cc.id AS id, cc.title AS title, cc.content AS content, score
         ORDER BY score DESC`,
        { k: topK * 3, embedding: queryEmbedding, documentId },
      );
      v.records.slice(0, topK).forEach((rec) =>
        add({
          id: rec.get("id"),
          label: "ContractClause",
          title: rec.get("title") ?? "",
          content: rec.get("content") ?? "",
          score: rec.get("score") as number,
          source: "Uploaded Contract",
        }),
      );
    } catch {
      /* index may be empty */
    }

    // Leg 2: keyword (fulltext / BM25) over this document's clauses
    try {
      const kw = await session.run(
        `CALL db.index.fulltext.queryNodes('clause_text_idx', $q)
         YIELD node AS cc, score
         WHERE cc.document_id = $documentId
         RETURN cc.id AS id, cc.title AS title, cc.content AS content, score
         ORDER BY score DESC LIMIT $k`,
        { q: escapeLucene(queryText), k: topK, documentId },
      );
      kw.records.forEach((rec) =>
        add({
          id: rec.get("id"),
          label: "ContractClause",
          title: rec.get("title") ?? "",
          content: rec.get("content") ?? "",
          score: (rec.get("score") as number) / 10,
          source: "Uploaded Contract",
        }),
      );
    } catch {
      /* index may be missing */
    }

    // Fallback: nothing matched → first clauses by index (so we never return empty for a stored doc)
    if (byId.size === 0) {
      const fb = await session.run(
        `MATCH (cc:ContractClause { document_id: $documentId })
         RETURN cc.id AS id, cc.title AS title, cc.content AS content
         ORDER BY cc.index ASC LIMIT $k`,
        { documentId, k: topK },
      );
      fb.records.forEach((rec) =>
        add({
          id: rec.get("id"),
          label: "ContractClause",
          title: rec.get("title") ?? "",
          content: rec.get("content") ?? "",
          score: 0.1,
          source: "Uploaded Contract",
        }),
      );
    }

    return [...byId.values()].sort((a, b) => b.score - a.score).slice(0, topK);
  } finally {
    await session.close();
  }
}

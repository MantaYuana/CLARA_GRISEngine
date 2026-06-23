import { getSession } from "../../config/neo4j";
import { embedText } from "../embedding/embeddingService";
import type { Clause } from "../ocr/ocrService";

export function buildClauseParams(documentId: string, userId: string, clause: Clause) {
  return {
    id: `${documentId}-${clause.index}`,
    documentId,
    userId,
    index: clause.index,
    header: clause.header,
    title: clause.title,
    pasalNumber: clause.pasal_number,
    content: clause.content,
    ayatJson: JSON.stringify(clause.ayat ?? []),
  };
}

/** Store all clauses for a document (embeddings use the "passage" prefix). */
export async function storeClauses(
  documentId: string,
  userId: string,
  clauses: Clause[],
): Promise<string[]> {
  const session = await getSession();
  const ids: string[] = [];
  try {
    for (const clause of clauses) {
      const params = buildClauseParams(documentId, userId, clause);
      let embedding: number[] = [];
      try {
        embedding = await embedText(
          clause.content || clause.title || clause.header,
          "passage",
        );
      } catch (e) {
        console.warn(
          `[clauseStore] embedding failed for ${params.id}:`,
          (e as Error).message,
        );
        // Do NOT store an empty embedding silently — leave the property unset so
        // contractRetrieval's fallback can tell "no vector" from "zero vector".
      }
      const setEmbed = embedding.length ? ", cc.embedding = $embedding" : "";
      await session.run(
        `
        MERGE (cc:ContractClause { id: $id })
        SET cc.document_id  = $documentId,
            cc.user_id      = $userId,
            cc.index        = $index,
            cc.header       = $header,
            cc.title        = $title,
            cc.pasal_number = $pasalNumber,
            cc.content      = $content,
            cc.ayat_json    = $ayatJson,
            cc.created_at   = datetime()${setEmbed}
        WITH cc
        MATCH (d:Document { id: $documentId })
        MERGE (cc)-[:PART_OF]->(d)
        `,
        { ...params, embedding },
      );
      ids.push(params.id);
    }
  } finally {
    await session.close();
  }
  return ids;
}

import { getDriver, closeDriver, getSession } from "../config/neo4j";
import { segmentClauses } from "../services/ocr/ocrService";
import { storeClauses } from "../services/document/clauseStore";

async function run() {
  const session = getDriver().session();
  try {
    const docs = await session.run(
      `MATCH (d:Document) RETURN d.id AS id, d.user_id AS userId, d.raw_text AS raw`,
    );
    for (const rec of docs.records) {
      const id = rec.get("id");
      const userId = rec.get("userId") ?? "demo-user";
      const raw = rec.get("raw") as string;
      if (!id || !raw) continue;
      // delete old clauses for this document
      const s2 = await getSession();
      try {
        await s2.run(`MATCH (cc:ContractClause { document_id: $id }) DETACH DELETE cc`, {
          id,
        });
      } finally {
        await s2.close();
      }
      const clauses = segmentClauses(raw);
      await storeClauses(id, userId, clauses);
      // refresh pasal_count on the document
      const s3 = await getSession();
      try {
        await s3.run(
          `MATCH (cc:ContractClause { document_id: $id }) WHERE cc.pasal_number IS NOT NULL
           WITH count(DISTINCT cc.pasal_number) AS n
           MATCH (d:Document { id: $id }) SET d.pasal_count = n`,
          { id },
        );
      } finally {
        await s3.close();
      }
      console.log(`[reprocess] ${id}: ${clauses.length} clauses`);
    }
  } finally {
    await session.close();
  }
}
run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(closeDriver);

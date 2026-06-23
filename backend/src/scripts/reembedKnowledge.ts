import { getDriver, closeDriver } from "../config/neo4j";
import { embedText } from "../services/embedding/embeddingService";

async function run() {
  const session = getDriver().session();
  try {
    const labels = ["Article", "LegalConcept", "ContractClause"];
    for (const label of labels) {
      const res = await session.run(
        `MATCH (n:${label}) WHERE coalesce(n.content, n.description, n.title, n.name) IS NOT NULL
         RETURN n.id AS id, coalesce(n.content, n.description, n.title, n.name) AS text`,
      );
      for (const rec of res.records) {
        const id = rec.get("id");
        const text = rec.get("text") as string;
        if (!id || !text) continue;
        const embedding = await embedText(text, "passage");
        await session.run(`MATCH (n:${label} { id: $id }) SET n.embedding = $embedding`, {
          id,
          embedding,
        });
        console.log(`[reembed] ${label} ${id}`);
      }
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

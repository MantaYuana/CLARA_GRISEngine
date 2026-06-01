/**
 * initSchema.ts
 * IMPORTANT: run once on startup to create:
 * – uniqueness constraints
 * – vector indexes (768-dim cosine) for dense retrieval
 * – full-text index for BM25 retrieval
 */
import { getDriver, closeDriver } from "../config/neo4j";
import { env } from "../config/env";

async function initSchema(): Promise<void> {
  const driver = getDriver();
  const session = driver.session();

  try {
    // Constraints
    const constraints: string[] = [
      "CREATE CONSTRAINT law_id IF NOT EXISTS FOR (l:Law) REQUIRE l.id IS UNIQUE",
      "CREATE CONSTRAINT article_id IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE",
      "CREATE CONSTRAINT legal_concept_name IF NOT EXISTS FOR (c:LegalConcept) REQUIRE c.name IS UNIQUE",
      "CREATE CONSTRAINT clause_template_id IF NOT EXISTS FOR (t:ClauseTemplate) REQUIRE t.id IS UNIQUE",
      "CREATE CONSTRAINT contract_clause_id IF NOT EXISTS FOR (cc:ContractClause) REQUIRE cc.id IS UNIQUE",
      // Module 3 – User isolation
      "CREATE CONSTRAINT user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
      "CREATE CONSTRAINT drafter_session_id IF NOT EXISTS FOR (ds:DrafterSession) REQUIRE ds.id IS UNIQUE",
      // Chat persistence
      "CREATE CONSTRAINT chat_session_id IF NOT EXISTS FOR (cs:ChatSession) REQUIRE cs.id IS UNIQUE",
      "CREATE CONSTRAINT chat_message_id IF NOT EXISTS FOR (cm:ChatMessage) REQUIRE cm.id IS UNIQUE",
      // Document storage
      "CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE",
    ];
    for (const cql of constraints) {
      await session.run(cql);
    }
    // Module 3 – Index on google_id for fast OAuth lookups
    await session.run("CREATE INDEX user_google_id IF NOT EXISTS FOR (u:User) ON (u.google_id)");

    // vector Indexes for Article embeddings
    await session.run(`
      CREATE VECTOR INDEX article_embedding_idx IF NOT EXISTS
      FOR (a:Article) ON (a.embedding)
      OPTIONS { indexConfig: {
        \`vector.dimensions\`: ${env.EMBEDDING_DIMENSION},
        \`vector.similarity_function\`: 'cosine'
      }}
    `);
    // ContractClause embeddings
    await session.run(`
      CREATE VECTOR INDEX contract_clause_embedding_idx IF NOT EXISTS
      FOR (cc:ContractClause) ON (cc.embedding)
      OPTIONS { indexConfig: {
        \`vector.dimensions\`: ${env.EMBEDDING_DIMENSION},
        \`vector.similarity_function\`: 'cosine'
      }}
    `);

    // Full-text Index (for BM25) 
    await session.run(`
      CREATE FULLTEXT INDEX article_text_idx IF NOT EXISTS
      FOR (a:Article|LegalConcept) ON EACH [a.content, a.title, a.name]
    `);
  } finally {
    await session.close();
  }
}

// IMPORTANT: only run directly via `npm run init-schema`
if (require.main === module) {
  initSchema()
    .catch((err) => {
      console.error("Schema init failed:", err);
      process.exit(1);
    })
    .finally(closeDriver);
}

export { initSchema };

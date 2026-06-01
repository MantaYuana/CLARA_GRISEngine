/**
 * seedFromPdf.ts
 * Automatically seeds ALL PDF documents found in backend/base_knowledge
 * into the Neo4j Legal Knowledge Graph.
 *
 * Usage:
 *   npm run seed:pdf
 *   npm run seed:pdf -- --dry-run          # preview clauses, no DB writes
 *   npm run seed:pdf -- --force            # re-seed even if Law node already exists
 */
import * as fs from "fs";
import * as path from "path";
import { getDriver, closeDriver, verifyConnectivity } from "../config/neo4j";
import { extractTextFromPdf } from "../services/ocr/ocrService";
import { segmentClauses } from "../services/ocr/ocrService";
import { embedText } from "../services/embedding/embeddingService";

// Config

const KNOWLEDGE_BASE_DIR = path.resolve(__dirname, "../../base_knowledge");

// CLI flags
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");

// Helpers
function getPdfFiles(): string[] {
  if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
    console.error(`Knowledge base directory not found: ${KNOWLEDGE_BASE_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(KNOWLEDGE_BASE_DIR)
    .filter((f) => path.extname(f).toLowerCase() === ".pdf")
    .map((f) => path.join(KNOWLEDGE_BASE_DIR, f));

  if (files.length === 0) {
    console.error(`No PDF files found in: ${KNOWLEDGE_BASE_DIR}`);
    process.exit(1);
  }

  return files;
}

function buildLawId(filePath: string): string {
  return `PDF-${path.basename(filePath, ".pdf").toUpperCase().replace(/\s+/g, "-")}`;
}

function buildLawTitle(filePath: string): string {
  return path.basename(filePath, ".pdf");
}

// Per-file seeding
async function seedFile(filePath: string, index: number, total: number): Promise<void> {
  const lawId = buildLawId(filePath);
  const lawTitle = buildLawTitle(filePath);

  console.log("");
  console.log(`[${index}/${total}] ${path.basename(filePath)}`);
  console.log(`       Law ID:    ${lawId}`);
  console.log(`       Law Title: ${lawTitle}`);

  // Read PDF
  const pdfBuffer = fs.readFileSync(filePath);
  console.log(`       File size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

  // OCR
  console.log("       Extracting text...");
  const rawText = await extractTextFromPdf(pdfBuffer);
  console.log(`       Extracted: ${rawText.length} characters`);

  // Segment
  console.log("       Segmenting into clauses...");
  const clauses = segmentClauses(rawText);
  console.log(`       Clauses found: ${clauses.length}`);

  if (DRY_RUN) {
    console.log("       [DRY RUN] Clause preview:");
    clauses.slice(0, 5).forEach((c) => {
      console.log(
        `         [${c.index}] ${c.header} — ${c.content_preview.slice(0, 80)}...`,
      );
    });
    if (clauses.length > 5)
      console.log(`         ... and ${clauses.length - 5} more clauses`);
    console.log("       [DRY RUN] Skipping Neo4j write.");
    return;
  }

  const session = getDriver().session();

  try {
    // Check if already seeded (skip unless --force)
    if (!FORCE) {
      const result = await session.run(
        `MATCH (l:Law { id: $lawId }) RETURN l.id LIMIT 1`,
        { lawId },
      );
      if (result.records.length > 0) {
        console.log(`       Already seeded — skipping. Use --force to re-seed.`);
        return;
      }
    }

    // Create/Upsert Law node
    await session.run(
      `
      MERGE (l:Law { id: $lawId })
      SET l.title       = $lawTitle,
          l.source_file = $sourceFile,
          l.seeded_at   = datetime()
      `,
      { lawId, lawTitle, sourceFile: path.basename(filePath) },
    );
    console.log(`       Law node upserted.`);

    // Embed + store clauses
    console.log(`       Embedding and storing ${clauses.length} clauses...`);
    let stored = 0;
    let skipped = 0;

    for (const clause of clauses) {
      const articleId = `${lawId}-${String(clause.index).padStart(4, "0")}`;
      const contentForEmbedding = `${clause.header}. ${clause.content}`.slice(0, 8000);

      let embedding: number[] = [];
      try {
        embedding = await embedText(contentForEmbedding);
      } catch {
        skipped++;
      }

      await session.run(
        `
        MERGE (a:Article { id: $id })
        SET a.number     = $number,
            a.title      = $title,
            a.content    = $content,
            a.law_id     = $lawId,
            a.embedding  = $embedding,
            a.seeded_at  = datetime()
        WITH a
        MATCH (l:Law { id: $lawId })
        MERGE (a)-[:PART_OF]->(l)
        `,
        {
          id: articleId,
          number: clause.header,
          title: clause.header,
          content: clause.content,
          lawId,
          embedding,
        },
      );

      stored++;
      if (stored % 10 === 0 || stored === clauses.length) {
        process.stdout.write(
          `\r       Progress: ${stored}/${clauses.length} clauses stored`,
        );
      }

      if (embedding.length > 0) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    console.log("");
    console.log(`       Done — ${stored} clauses stored, ${skipped} embeddings skipped.`);
  } finally {
    await session.close();
  }
}

// Main

async function main(): Promise<void> {
  const pdfFiles = getPdfFiles();

  console.log("");
  console.log("CLARA — Bulk PDF Seeder");
  console.log("─".repeat(50));
  console.log(`Knowledge base: ${KNOWLEDGE_BASE_DIR}`);
  console.log(`PDFs found:     ${pdfFiles.length}`);
  console.log(`Dry run:        ${DRY_RUN}`);
  console.log(`Force re-seed:  ${FORCE}`);
  console.log("─".repeat(50));

  if (!DRY_RUN) {
    console.log("\nConnecting to Neo4j...");
    await verifyConnectivity();
    console.log("Connected.");
  }

  for (let i = 0; i < pdfFiles.length; i++) {
    await seedFile(pdfFiles[i], i + 1, pdfFiles.length);
  }

  console.log("");
  console.log("─".repeat(50));
  console.log(`All ${pdfFiles.length} PDF(s) processed successfully.`);
}

main()
  .catch((err) => {
    console.error("\nSeeding failed:", err?.message ?? err);
    process.exit(1);
  })
  .finally(closeDriver);

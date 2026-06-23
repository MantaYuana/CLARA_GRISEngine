/**
 * analysisWorker.ts
 * BullMQ Worker – processes document-analysis jobs from analysisQueue.
 *
 * Per job:
 *  1. OCR the uploaded file buffer
 *  2. Run guardrail checks
 *  3. Store ContractClause nodes + embeddings in Neo4j (scoped to userId)
 */
import { Worker, Job } from "bullmq";
import { getRedis } from "../config/redis";
import { processUploadedFile } from "../services/ocr/ocrService";
import { runGuardrailChecks } from "../services/guardrail/guardrailService";
import type { AnalysisJob } from "../queues/analysisQueue";
import { storeClauses } from "../services/document/clauseStore";

export const analysisWorker = new Worker<AnalysisJob>(
  "document-analysis",
  async (job: Job<AnalysisJob>) => {
    const { documentId, userId, bufferBase64, mimeType } = job.data;
    const buffer = Buffer.from(bufferBase64, "base64");

    // Step 1: OCR
    await job.updateProgress(10);
    const ocrResult = await processUploadedFile(buffer, mimeType);

    // Step 2: Guardrail
    await job.updateProgress(50);
    const guardrail = await runGuardrailChecks(ocrResult.raw_text);

    // Step 3: Store clauses
    await job.updateProgress(70);
    await storeClauses(documentId, userId, ocrResult.clauses);

    await job.updateProgress(100);

    // Return value is stored as job.returnvalue in BullMQ
    return {
      document_id: documentId,
      raw_text: ocrResult.raw_text,
      language: ocrResult.language,
      page_count: ocrResult.page_count ?? null,
      clauses: ocrResult.clauses.map((c) => ({
        index: c.index,
        header: c.header,
        content_preview: c.content_preview,
        pasal_references: c.pasal_references,
      })),
      guardrail: {
        is_safe: guardrail.is_safe,
        critical_violations: guardrail.critical_violations,
        warning_count: guardrail.warning_count,
        extracted_variables: guardrail.extracted_variables,
        all_checks: guardrail.checks,
      },
    };
  },
  {
    connection: getRedis(),
    concurrency: 3,
  },
);

analysisWorker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed.`));
analysisWorker.on("failed", (job, err) =>
  console.error(`[Worker] Job ${job?.id} failed:`, err.message),
);

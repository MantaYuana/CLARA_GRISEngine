/**
 * document.ts
 * POST /api/v1/document/analyze       – Upload, OCR, store Document node (with base64) + clauses in Neo4j
 * GET  /api/v1/document/:documentId   – Fetch stored document metadata + clauses by ID
 * GET  /api/v1/document/analyze/:jobId/status – Poll async job status (when Redis available)
 *
 * @swagger
 * tags:
 *   name: Document
 *   description: Contract document ingestion – OCR, clause extraction, embedding, and Neo4j storage
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { processUploadedFile } from "../services/ocr/ocrService";
import { embedText } from "../services/embedding/embeddingService";
import { runGuardrailChecks } from "../services/guardrail/guardrailService";
import { getSession } from "../config/neo4j";
import { TaskType } from "@google/generative-ai";
import { success, error as apiError } from "../utils/response";
import { verifyToken } from "../middleware/auth";
import { getUserDashboard } from "../services/dashboard/dashboardService";

const router = Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE_MB ?? "10") * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/tiff",
            "image/bmp",
        ];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: PDF, JPEG, PNG, WebP, TIFF, BMP.`));
        }
    },
});

//   Helpers     ─

async function saveDocumentNode(
    documentId: string,
    userId: string,
    filename: string,
    mimeType: string,
    fileBase64: string,
    rawText: string,
    pageCount: number | null,
    clauseCount: number,
): Promise<void> {
    const session = await getSession();
    try {
        await session.run(
            `
      MERGE (d:Document { id: $id })
      SET d.user_id      = $userId,
          d.filename     = $filename,
          d.mime_type    = $mimeType,
          d.file_base64  = $fileBase64,
          d.raw_text     = $rawText,
          d.page_count   = $pageCount,
          d.clause_count = $clauseCount,
          d.created_at   = datetime()
      `,
            { id: documentId, userId, filename, mimeType, fileBase64, rawText, pageCount, clauseCount },
        );
    } finally {
        await session.close();
    }
}

async function storeClauses(
    documentId: string,
    userId: string,
    clauses: Awaited<ReturnType<typeof processUploadedFile>>["clauses"],
): Promise<string[]> {
    const session = await getSession();
    const storedIds: string[] = [];
    try {
        for (const clause of clauses) {
            let embedding: number[] = [];
            try {
                embedding = await embedText(clause.content || clause.header, TaskType.RETRIEVAL_DOCUMENT);
            } catch {
                // Embedding failure doesn't block storage
            }

            const clauseId = `${documentId}-${clause.index}`;
            await session.run(
                `
        MERGE (cc:ContractClause { id: $id })
        SET cc.document_id = $documentId,
            cc.user_id     = $userId,
            cc.index       = $index,
            cc.header      = $header,
            cc.content     = $content,
            cc.embedding   = $embedding,
            cc.created_at  = datetime()
        WITH cc
        MATCH (d:Document { id: $documentId })
        MERGE (cc)-[:PART_OF]->(d)
        `,
                {
                    id: clauseId,
                    documentId,
                    userId,
                    index: clause.index,
                    header: clause.header,
                    content: clause.content,
                    embedding,
                },
            );
            storedIds.push(clauseId);
        }
    } finally {
        await session.close();
    }
    return storedIds;
}

//   POST /api/v1/document/analyze    

/**
 * @swagger
 * /api/v1/document/analyze:
 *   post:
 *     summary: Upload a contract document for OCR, clause extraction, and Neo4j storage
 *     tags: [Document]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Document successfully processed and stored
 */
router.post(
    "/analyze",
    verifyToken,
    upload.single("file"),
    async (req: Request, res: Response): Promise<void> => {
        if (!req.file) {
            res.status(400).json(apiError("MISSING_FILE", 'A file upload is required.'));
            return;
        }

        const documentId = uuidv4();
        const userId = (req as Request & { user?: { userId: string } }).user?.userId;

        if (!userId) {
            res.status(401).json(apiError("UNAUTHORIZED", "User must be authenticated to analyze documents."));
            return;
        }
        const filename = req.file.originalname ?? `document-${documentId}`;
        const fileBase64 = req.file.buffer.toString("base64");

        try {
            const ocrResult = await processUploadedFile(req.file.buffer, req.file.mimetype);
            const guardrail = await runGuardrailChecks(ocrResult.raw_text);

            await saveDocumentNode(
                documentId,
                userId,
                filename,
                req.file.mimetype,
                fileBase64,
                ocrResult.raw_text,
                ocrResult.page_count ?? null,
                ocrResult.clauses.length,
            );

            const storedClauseIds = await storeClauses(documentId, userId, ocrResult.clauses);

            res.json(success({
                document_id: documentId,
                filename,
                raw_text: ocrResult.raw_text,
                page_count: ocrResult.page_count ?? null,
                clause_count: ocrResult.clauses.length,
                clauses: ocrResult.clauses.map((c) => ({
                    index: c.index,
                    header: c.header,
                    content_preview: c.content_preview,
                })),
                stored_clause_ids: storedClauseIds,
                guardrail: {
                    is_safe: guardrail.is_safe,
                    warning_count: guardrail.warning_count,
                    critical_violations: guardrail.critical_violations,
                },
            }));
        } catch (err: unknown) {
            console.error("[document/analyze]", err);
            res.status(500).json(apiError("ANALYSIS_ERROR", err instanceof Error ? err.message : "Internal server error"));
        }
    },
);

//   GET /api/v1/document/user  

/**
 * @swagger
 * /api/v1/document/user:
 *   get:
 *     summary: Get all documents and drafter projects for the current user
 *     tags: [Document]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of user projects and documents
 */
router.get("/user", verifyToken, async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & { user?: { userId: string } }).user?.userId;

    if (!userId || userId === "anonymous") {
        res.status(401).json(apiError("UNAUTHORIZED", "You must be logged in to view your documents."));
        return;
    }

    try {
        const history = await getUserDashboard(userId);
        res.json(success(history));
    } catch (err: unknown) {
        console.error("[document/user]", err);
        res.status(500).json(apiError("INTERNAL", err instanceof Error ? err.message : "Internal server error"));
    }
});

//   GET /api/v1/document/:documentId     ─

/**
 * @swagger
 * /api/v1/document/{documentId}:
 *   get:
 *     summary: Retrieve a stored document
 *     tags: [Document]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Document found
 */
router.get(
    "/:documentId",
    async (req: Request, res: Response): Promise<void> => {
        const { documentId } = req.params;
        const session = await getSession();

        try {
            const result = await session.run(
                `
        MATCH (d:Document { id: $documentId })
        OPTIONAL MATCH (cc:ContractClause)-[:PART_OF]->(d)
        WITH d, cc ORDER BY cc.index ASC
        WITH d, collect({
          id:              cc.id,
          index:           cc.index,
          header:          cc.header,
          content_preview: substring(coalesce(cc.content, ''), 0, 200)
        }) AS clauses
        RETURN d, clauses
        `,
                { documentId },
            );

            if (result.records.length === 0) {
                res.status(404).json(apiError("NOT_FOUND", `Document "${documentId}" not found.`));
                return;
            }

            const record = result.records[0];
            const doc = record.get("d").properties;
            const clauses = record.get("clauses") as any[];

            res.json(success({
                document_id: doc.id,
                filename: doc.filename,
                mime_type: doc.mime_type,
                page_count: doc.page_count,
                clause_count: doc.clause_count,
                raw_text: doc.raw_text,
                file_base64: doc.file_base64,
                created_at: doc.created_at,
                clauses: clauses.filter(c => c.id !== null),
            }));
        } catch (err: unknown) {
            console.error("[document/get]", err);
            res.status(500).json(apiError("INTERNAL", err instanceof Error ? err.message : "Internal server error"));
        } finally {
            await session.close();
        }
    },
);

//   GET /api/v1/document/analyze/:jobId/status   

/**
 * @swagger
 * /api/v1/document/analyze/{jobId}/status:
 *   get:
 *     summary: Poll the status of an async document analysis job
 *     tags: [Document]
 */
router.get(
    "/analyze/:jobId/status",
    async (req: Request, res: Response): Promise<void> => {
        try {
            const { analysisQueue } = await import("../queues/analysisQueue");
            const jobId = req.params.jobId;
            const job = await analysisQueue.getJob(String(jobId));
            if (!job) {
                res.status(404).json(apiError("JOB_NOT_FOUND", `Job ${jobId} not found.`));
                return;
            }

            const state = await job.getState();

            if (state === "completed") {
                res.json(success({ status: "completed", result: job.returnvalue }));
            } else if (state === "failed") {
                res.json(success({ status: "failed", reason: job.failedReason }));
            } else {
                res.json(success({ status: state, progress: job.progress }));
            }
        } catch {
            res.status(503).json(apiError("QUEUE_UNAVAILABLE", "Job queue is not available."));
        }
    },
);

export default router;

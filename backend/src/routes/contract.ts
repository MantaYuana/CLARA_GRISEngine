/**
 * contract.ts
 * POST /api/v1/contract/review
 *
 * Full contract review pipeline:
 *   OCR (if file attached) → clause extraction → guardrail checks →
 *   hybrid retrieval → Gemini reasoning with confidence scoring + citations
 *
 * Accepts:
 *   - multipart/form-data: file (PDF or image) + optional question
 *   - application/json: { text, question }
 *
 * @swagger
 * tags:
 *   name: Contract
 *   description: Full AI-powered contract review pipeline
 */
import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { processUploadedFile } from "../services/ocr/ocrService";
import { runGuardrailChecks } from "../services/guardrail/guardrailService";
import { fetchSubgraphEdges } from "../services/retrieval/graphContext";
import type { RetrievalTrace } from "../services/retrieval/retrievalTrace";
import { answerQuestion } from "../services/reasoning/answerService";
import { success, error as apiError } from "../utils/response";
import { env } from "../config/env";
import { storeClauses } from "../services/document/clauseStore";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const TextBodySchema = z.object({
  text: z.string().min(10).optional(),
  session_id: z.string().optional(),
  question: z
    .string()
    .optional()
    .default("Analisis kontrak ini dan temukan klausula yang berpotensi merugikan."),
});

//  POST /api/v1/contract/review

/**
 * @swagger
 * /api/v1/contract/review:
 *   post:
 *     summary: Full contract review – OCR + guardrail + AI reasoning + citations
 *     description: |
 *       Full contract review pipeline: OCR (if file attached) → guardrail checks →
 *       hybrid retrieval (dense + BM25 + symbolic) → AI reasoning with confidence
 *       scoring and legal citations.
 *
 *       Accepts **either** a file upload (multipart/form-data) **or** raw contract
 *       text (application/json). The `question` field is optional and defaults to a
 *       general Indonesian-law compliance check.
 *     tags: [Contract]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: "Contract document — JPEG/PNG/WebP/TIFF/BMP or PDF (max 20 MB)"
 *               question:
 *                 type: string
 *                 description: "Specific review question. Defaults to general compliance check."
 *                 example: "Apakah kontrak ini memiliki klausula yang bermasalah?"
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 minLength: 10
 *                 description: "Raw contract text as plain string"
 *               question:
 *                 type: string
 *                 description: "Specific review question. Defaults to general compliance check."
 *     responses:
 *       200:
 *         description: Contract review result with reasoning, citations, and guardrail report
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 question:
 *                   type: string
 *                   example: "Apakah kontrak ini memiliki klausula yang bermasalah?"
 *                 answer:
 *                   type: string
 *                   example: "Berdasarkan Pasal 1320 KUHPerdata, kontrak ini memiliki..."
 *                 confidence:
 *                   type: object
 *                   properties:
 *                     level:
 *                       type: string
 *                       enum: [GREEN, YELLOW, RED]
 *                       example: GREEN
 *                     score:
 *                       type: number
 *                       example: 0.9
 *                     rationale:
 *                       type: string
 *                       example: "Semua 3 jalur penalaran setuju..."
 *                 citations:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       reference:
 *                         type: string
 *                         example: "Pasal 1320"
 *                       source:
 *                         type: string
 *                         example: "KUHPerdata"
 *                 clauses:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       index:
 *                         type: integer
 *                       header:
 *                         type: string
 *                         example: "Pasal 1"
 *                       content_preview:
 *                         type: string
 *                       pasal_references:
 *                         type: array
 *                         items:
 *                           type: string
 *                 guardrail:
 *                   type: object
 *                   properties:
 *                     has_violations:
 *                       type: boolean
 *                     violation_count:
 *                       type: integer
 *                     critical_violations:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["interest_rate_per_annum"]
 *                     checks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           metric:
 *                             type: string
 *                             example: "interest_rate_per_annum"
 *                           extracted_value:
 *                             type: number
 *                             example: 36
 *                           limit_value:
 *                             type: number
 *                             example: 24
 *                           status:
 *                             type: string
 *                             enum: [OK, EXCEEDS_LIMIT, WARNING]
 *                             example: "EXCEEDS_LIMIT"
 *                           message:
 *                             type: string
 *                             example: "⚠️ Nilai 36% melebihi batas maksimum 24%..."
 *                 retrieval_context:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "article-1320"
 *                       label:
 *                         type: string
 *                         example: "Article"
 *                       title:
 *                         type: string
 *                         example: "Pasal 1320 KUHPerdata"
 *                       hybrid_score:
 *                         type: number
 *                         example: 0.88
 *                       sources:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ["dense", "bm25"]
 *                 meta:
 *                   type: object
 *                   properties:
 *                     context_nodes_used:
 *                       type: integer
 *                       example: 5
 *                     reasoning_paths_generated:
 *                       type: integer
 *                       example: 3
 *       400:
 *         description: Neither file nor text provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 code:
 *                   type: string
 *                   example: INVALID_INPUT
 *                 message:
 *                   type: string
 *       500:
 *         description: OCR, retrieval, or reasoning failure
 */
router.post(
  "/review",
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const userId =
      (req as Request & { user?: { userId: string } }).user?.userId ?? "anonymous";

    try {
      let contractText = "";
      const question =
        (req.body?.question as string) ||
        "Analisis kontrak ini dan temukan klausula yang berpotensi merugikan.";
      const documentId = uuidv4();

      //  File path
      if (req.file) {
        const ocrResult = await processUploadedFile(req.file.buffer, req.file.mimetype);
        contractText = ocrResult.raw_text;

        // Store clause nodes so Phase 2 (/validate) retrieval + structural lookups work.
        await storeClauses(documentId, userId, ocrResult.clauses);

        // Phase 1 is an OCR preview only: extract numeric variables for the user to
        // confirm. Guardrail checks + AI reasoning run in Phase 2 (/validate), so we
        // deliberately do NOT spend an LLM reasoning cycle here.
        const { extractNumericVariables } = await import("../services/ocr/ocrService");
        const extracted_variables = extractNumericVariables(contractText);

        res.json(
          success({
            needs_ocr_validation: true,
            document_id: documentId,
            question,
            raw_text: contractText,
            clauses: ocrResult.clauses.map((c) => ({
              index: c.index,
              header: c.header,
              content_preview: c.content_preview,
              pasal_references: c.pasal_references,
            })),
            extracted_variables,
            language: "en",
          }),
        );
        return;
      }

      //  Text-only path
      const parsed = TextBodySchema.safeParse(req.body);
      if (!parsed.success || !parsed.data.text) {
        res
          .status(400)
          .json(
            apiError("INVALID_INPUT", 'Provide either a file upload or a "text" field.'),
          );
        return;
      }

      contractText = parsed.data.text;
      const resolvedQuestion = parsed.data.question;
      const session_id = parsed.data.session_id ?? uuidv4();

      // 1. Save user interaction
      const { saveChatMessage } = await import("../services/chat/chatService");
      await saveChatMessage(
        session_id,
        userId,
        "contract",
        "user",
        resolvedQuestion,
        documentId,
      );

      const trace: Partial<RetrievalTrace> = { query: resolvedQuestion };
      const [guardrail, result] = await Promise.all([
        runGuardrailChecks(contractText),
        answerQuestion({
          question: resolvedQuestion,
          documentId: undefined,
          history: [{ role: "user", content: `Contract to analyze:\n${contractText}` }],
          allowStructural: false,
          trace,
        }),
      ]);
      if (trace.graph) {
        trace.graph.edges = await fetchSubgraphEdges(
          (trace.graph.nodes ?? []).map((n) => n.id),
        ).catch(() => []);
      }

      // 2. Save AI response
      await saveChatMessage(
        session_id,
        userId,
        "contract",
        "model",
        result.answer,
        documentId,
      );

      res.json(
        success({
          success: true,
          session_id,
          question: resolvedQuestion,
          document_id: documentId,
          answer: result.answer,
          confidence: result.confidence,
          citations: result.citations,
          clauses: [],
          guardrail: {
            has_violations: !guardrail.is_safe,
            violation_count: guardrail.critical_violations.length,
            critical_violations: guardrail.critical_violations,
            checks: guardrail.checks,
          },
          retrieval_context: (trace.graph?.nodes ?? []).map((n) => ({
            id: n.id,
            label: n.label,
            title: n.title,
            hybrid_score: n.fusedScore,
            source: n.source,
          })),
          meta: {
            context_nodes_used: result.contextCount,
            reasoning_paths_generated: 3,
          },
          language: "id",
          trace: env.TRACE_ENABLED ? (trace as RetrievalTrace) : undefined,
        }),
      );
    } catch (err: unknown) {
      console.error("[contract/review]", err);
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json(apiError("INTERNAL", message));
    }
  },
);

//   POST /api/v1/contract/validate  (Phase 2)
//
// Accepts corrected numeric variables from the frontend OCR-validation card,
// runs the deterministic guardrail checks, performs hybrid retrieval, and
// returns the full AI reasoning + citation response.

/**
 * @swagger
 * /api/v1/contract/validate:
 *   post:
 *     summary: "Phase 2 — Run guardrail + AI reasoning on corrected OCR variables"
 *     tags: [Contract]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [document_id, question]
 *             properties:
 *               document_id:
 *                 type: string
 *                 description: document_id returned by Phase 1 (/review)
 *               question:
 *                 type: string
 *               raw_text:
 *                 type: string
 *                 description: Contract raw text from Phase 1 (used for guardrail pattern matching)
 *               corrected_variables:
 *                 type: object
 *                 description: NumericVariables after user correction
 *                 properties:
 *                   interest_percent_per_month: { type: number }
 *                   penalty_percent_per_month: { type: number }
 *                   late_interest_percent_per_day: { type: number }
 *                   retention_percent: { type: number }
 *                   dp_percent: { type: number }
 *                   penalty_lump_sum_idr: { type: number }
 *                   pkwt_duration_years: { type: number }
 *     responses:
 *       200:
 *         description: Full contract analysis (guardrail + reasoning + citations)
 *       400:
 *         description: Validation error
 */

const ValidateBodySchema = z.object({
  document_id: z.string().min(1, "document_id is required"),
  question: z
    .string()
    .optional()
    .default("Analisis kontrak ini dan temukan klausula yang berpotensi merugikan."),
  raw_text: z.string().optional().default(""),
  corrected_variables: z
    .object({
      interest_percent_per_month: z.number().optional(),
      penalty_percent_per_month: z.number().optional(),
      late_interest_percent_per_day: z.number().optional(),
      retention_percent: z.number().optional(),
      dp_percent: z.number().optional(),
      penalty_lump_sum_idr: z.number().optional(),
      pkwt_duration_years: z.number().optional(),
    })
    .optional()
    .default({}),
});

router.post("/validate", async (req: Request, res: Response): Promise<void> => {
  const parsed = ValidateBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json(
        apiError(
          "VALIDATION_ERROR",
          "Invalid request body",
          parsed.error.flatten().fieldErrors,
        ),
      );
    return;
  }

  const { document_id, question, raw_text, corrected_variables } = parsed.data;

  try {
    // Run guardrail using the user-corrected variables.
    // We inject corrected_variables directly into the guardrail service by
    // temporarily overriding the extracted values — achieved by building a
    // synthetic text stub AND passing corrected_variables via the low-level
    // runNumericChecks path exposed in guardrailService.
    //
    // For now we run keyword checks on raw_text and numeric checks on
    // corrected_variables via a thin re-export from guardrailService.
    const { runGuardrailChecksWithVariables } =
      await import("../services/guardrail/guardrailService");
    const guardrail = await runGuardrailChecksWithVariables(
      raw_text,
      corrected_variables,
    );

    const trace: Partial<RetrievalTrace> = { query: question };
    const result = await answerQuestion({
      question,
      documentId: document_id,
      history: [{ role: "user", content: `Kontrak untuk dianalisis:\n${raw_text}` }],
      allowStructural: false,
      trace,
    });

    if (trace.graph) {
      trace.graph.edges = await fetchSubgraphEdges(
        (trace.graph.nodes ?? []).map((r) => r.id),
      ).catch(() => []);
    }

    res.json(
      success({
        success: true,
        question,
        document_id,
        answer: result.answer,
        confidence: result.confidence,
        citations: result.citations,
        trace: env.TRACE_ENABLED ? (trace as RetrievalTrace) : undefined,
        guardrail: {
          has_violations: !guardrail.is_safe,
          violation_count: guardrail.critical_violations.length,
          critical_violations: guardrail.critical_violations,
          checks: guardrail.checks,
          corrected_variables, // echo back so frontend can confirm what was used
        },
        retrieval_context: (trace.graph?.nodes ?? []).map((n) => ({
          id: n.id,
          label: n.label,
          title: n.title,
          hybrid_score: n.fusedScore,
          source: n.source,
        })),
        meta: {
          context_nodes_used: result.contextCount,
          reasoning_paths_generated: 3,
        },
        language: "id",
      }),
    );
  } catch (err: unknown) {
    console.error("[contract/validate]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json(apiError("INTERNAL", message));
  }
});

export default router;

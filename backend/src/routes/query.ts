/**
 * query.ts
 * POST /api/v1/query
 *
 * General-purpose legal Q&A endpoint.
 * When document_id is provided:
 *   1. Tries hybrid retrieval (vector + BM25 + symbolic + contract clauses)
 *   2. If context is empty, falls back to fetching raw_text directly from the
 *      Document node in Neo4j and inserting it as conversation context.
 *
 * @swagger
 * tags:
 *   name: Query
 *   description: Legal Q&A with optional document context
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { answerQuestion } from "../services/reasoning/answerService";
import { fetchSubgraphEdges } from "../services/retrieval/graphContext";
import type { RetrievalTrace } from "../services/retrieval/retrievalTrace";
import { getSession } from "../config/neo4j";
import { v4 as uuidv4 } from "uuid";
import { success, error } from "../utils/response";
import { env } from "../config/env";

// --- Pindahkan import ke paling atas ---
import { getSessionHistory, saveChatMessage } from "../services/chat/chatService";

const router = Router();

const QuerySchema = z.object({
  question: z.string().min(3, "Question must be at least 3 characters"),
  document_id: z.string().uuid().optional(),
  session_id: z.string().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .optional()
    .default([]),
  answer_mode: z.enum(["raw", "natural"]).optional(),
});

/**
 * @swagger
 * /api/v1/query:
 *   post:
 *     summary: Legal Q&A with hybrid retrieval and optional document context
 *     description: |
 *       Ask a legal question with optional uploaded document context.
 *       When `document_id` is provided, the system first tries hybrid retrieval
 *       over stored clauses. If no clauses are found, it falls back to injecting
 *       the document's `raw_text` directly into the reasoning context.
 *     tags: [Query]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties:
 *               question:
 *                 type: string
 *                 minLength: 3
 *                 example: "Siapa pihak pertama dan pihak kedua dalam MoU ini?"
 *               document_id:
 *                 type: string
 *                 format: uuid
 *                 description: "UUID returned from POST /api/v1/document/analyze"
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Answer with citations and confidence score
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 answer:
 *                   type: string
 *                 confidence:
 *                   type: number
 *                 citations:
 *                   type: array
 *                 document_id:
 *                   type: string
 *                 context_count:
 *                   type: integer
 *                 context_source:
 *                   type: string
 *                   enum: [retrieval, raw_text, none]
 *                   description: "How the document context was injected"
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/", async (req: Request, res: Response): Promise<void> => {
  const parsed = QuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json(
        error(
          "VALIDATION_ERROR",
          "Invalid request body",
          parsed.error.flatten().fieldErrors,
        ),
      );
    return;
  }

  const { question, document_id, history, session_id: req_session_id } = parsed.data;
  const userId =
    (req as Request & { user?: { userId: string } }).user?.userId ?? "anonymous";
  const session_id = req_session_id ?? uuidv4();

  try {
    // Penanganan Tipe TypeScript yang aman:
    // Mengakomodasi jika kembaliannya berupa Array langsung atau Object yang memiliki property 'history'
    const historyData = await getSessionHistory(session_id);
    const storedHistory: any[] = Array.isArray(historyData)
      ? historyData
      : ((historyData as any).history ?? []);

    // 1. Save user's question immediately
    await saveChatMessage(session_id, userId, "query", "user", question, document_id);

    // 2. Combine frontend history with stored history and format for Gemini reasoning
    const trace: Partial<RetrievalTrace> = { query: question };

    const baseHistory = storedHistory.length > 0 ? storedHistory : history;
    const extraHistory = baseHistory.map((h: any) => ({
      role:
        h.role === "assistant" || h.role === "model"
          ? ("model" as const)
          : ("user" as const),
      content: h.content,
    }));

    // 3. Orchestrator: routes structural vs reasoning, handles raw_text injection internally
    const result = await answerQuestion({
      question,
      documentId: document_id,
      history: extraHistory,
      answerMode: parsed.data.answer_mode,
      allowStructural: true,
      trace,
    });

    if (trace.graph) {
      trace.graph.edges = await fetchSubgraphEdges(
        (trace.graph.nodes ?? []).map((n) => n.id),
      ).catch(() => []);
    }

    // 4. Save assistant response
    await saveChatMessage(
      session_id,
      userId,
      "query",
      "assistant",
      result.answer,
      document_id,
    );

    res.json(
      success({
        session_id,
        answer: result.answer,
        confidence: result.confidence,
        confidence_level: result.confidence_level,
        citations: result.citations,
        document_id: document_id ?? null,
        context_count: result.contextCount,
        context_source: trace.contextSource,
        answer_mode: trace.answerMode ?? null,
        language: "id",
        trace: env.TRACE_ENABLED ? (trace as RetrievalTrace) : undefined,
      }),
    );
  } catch (err: unknown) {
    console.error("[query]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json(error("INTERNAL", message));
  }
});

/**
 * @swagger
 * /api/v1/query/history/{sessionId}:
 *   get:
 *     summary: Retrieve chat history for a specific query session
 *     tags: [Query]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Chat history
 *       401:
 *         description: Unauthorized
 */
router.get("/history/:sessionId", async (req: Request, res: Response): Promise<void> => {
  const sessionId = req.params.sessionId as string;

  try {
    const { getSessionHistory } = await import("../services/chat/chatService");
    const historyData = await getSessionHistory(sessionId);
    const history = Array.isArray(historyData)
      ? historyData
      : ((historyData as any).history ?? []);

    res.json(
      success({
        session_id: sessionId,
        history,
      }),
    );
  } catch (err: unknown) {
    console.error("[query/history]", err);
    res.status(500).json(error("INTERNAL", "Failed to retrieve chat history"));
  }
});

/**
 * @swagger
 * /api/v1/query/sessions:
 *   get:
 *     summary: List all query chat sessions for the current user
 *     tags: [Query]
 *     responses:
 *       200:
 *         description: List of sessions
 *       401:
 *         description: Unauthorized
 */
router.get("/sessions", async (req: Request, res: Response): Promise<void> => {
  const userId =
    (req as Request & { user?: { userId: string } }).user?.userId ?? "anonymous";

  try {
    const session = await getSession();
    const result = await session.run(
      `
            MATCH (cs:ChatSession { user_id: $userId, endpoint_type: 'query' })
            OPTIONAL MATCH (cs)-[:HAS_MESSAGE]->(cm:ChatMessage)
            WITH cs, cm ORDER BY cm.timestamp ASC
            WITH cs.id AS sessionId, 
                 toString(cs.updated_at) AS lastUpdated, 
                 collect(cm.content) AS messages
            RETURN sessionId, 
                   lastUpdated, 
                   COALESCE(messages[0], 'Percakapan Baru') AS preview
            ORDER BY lastUpdated DESC
            `,
      { userId },
    );
    await session.close();

    const sessions = result.records.map((record) => ({
      session_id: record.get("sessionId"),
      last_updated: record.get("lastUpdated"),
      preview: record.get("preview") || "Percakapan Baru",
    }));

    res.json(success(sessions));
  } catch (err: unknown) {
    console.error("[query/sessions]", err);
    res.status(500).json(error("INTERNAL", "Failed to retrieve sessions list"));
  }
});

export default router;

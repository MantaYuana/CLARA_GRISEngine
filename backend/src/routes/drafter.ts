/**
 * drafter.ts
 * POST /api/v1/drafter/chat
 *
 * Multi-turn document drafting (MoU / LoI / PKS).
 * Client must send full conversation history on every turn.
 *
 * @swagger
 * tags:
 *   name: Drafter
 *   description: Agentic multi-turn document drafter
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import { runDrafterTurn } from "../services/drafter/drafterService";
import { getSession } from "../config/neo4j";
import { success, error as apiError } from "../utils/response";

const router = Router();

const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const DrafterChatSchema = z.object({
  session_id: z.string().min(1, "session_id is required"),
  message: z.string().min(1, "message is required"),
});

/**
 * @swagger
 * /api/v1/drafter/chat:
 *   post:
 *     summary: Send a message to the agentic document drafter
 *     tags: [Drafter]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [session_id, message]
 *             properties:
 *               session_id:
 *                 type: string
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Drafter response (clarification or draft)
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post("/chat", async (req: Request, res: Response): Promise<void> => {
  const parsed = DrafterChatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(apiError("VALIDATION_ERROR", "Invalid request body", parsed.error.flatten().fieldErrors));
    return;
  }

  const userId = (req as Request & { user?: { userId: string } }).user?.userId ?? "anonymous";

  try {
    const response = await runDrafterTurn({ ...parsed.data, userId });
    res.json(success(response));
  } catch (err: unknown) {
    console.error("[drafter/chat]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json(apiError("INTERNAL", message));
  }
});

/**
 * @swagger
 * /api/v1/drafter/session/{sessionId}:
 *   get:
 *     summary: Retrieve existing Drafter session (fields + history)
 *     tags: [Drafter]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session data
 *       404:
 *         description: Session not found
 */
//   GET /api/v1/drafter/session/:sessionId                   
router.get("/session/:sessionId", async (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  try {
    const { getSessionHistory } = await import("../services/chat/chatService");
    const session = await getSession();
    const result = await session.run(
      `MATCH (ds:DrafterSession { id: $sessionId }) RETURN ds`,
      { sessionId },
    );
    await session.close();

    if (result.records.length === 0) {
      res.status(404).json(apiError("NOT_FOUND", "Session not found"));
      return;
    }

    const ds = result.records[0].get("ds").properties;
    const { history } = await getSessionHistory(sessionId);

    res.json(success({
      session_id: sessionId,
      document_type: ds.document_type,
      fields: JSON.parse(ds.fields),
      history
    }));
  } catch (err: unknown) {
    console.error("[drafter/session]", err);
    res.status(500).json(apiError("INTERNAL", "Failed to retrieve session"));
  }
});

export default router;

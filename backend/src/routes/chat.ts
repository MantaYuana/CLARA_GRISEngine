/**
 * chat.ts
 *
 * Universal endpoint to retrieve chat history for any session.
 */
import { Router, Request, Response } from "express";
import { getSessionHistory } from "../services/chat/chatService";
import { success, error as apiError } from "../utils/response";
import { verifyToken } from "../middleware/auth";

const router = Router();

/**
 * @swagger
 * /api/v1/chat/session/{sessionId}/history:
 *   get:
 *     summary: Retrieve chat history for a specific session
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: The session_id of the chat
 *     responses:
 *       200:
 *         description: List of chat messages
 *       404:
 *         description: Session not found
 *       401:
 *         description: Unauthorized
 */
router.get("/session/:sessionId/history", verifyToken, async (req: Request, res: Response) => {
    const sessionId = req.params.sessionId as string;

    try {
        const { history, endpoint_type } = await getSessionHistory(sessionId);
        res.json(success({
            session_id: sessionId,
            endpoint_type,
            history
        }));
    } catch (err: unknown) {
        console.error("[chat/history]", err);
        const message = err instanceof Error ? err.message : "Internal server error";
        res.status(500).json(apiError("INTERNAL", message));
    }
});

export default router;

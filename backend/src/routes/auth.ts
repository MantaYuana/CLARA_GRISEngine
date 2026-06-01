/**
 * auth.ts  (route)
 * Google OAuth 2.0 callback routes + /me endpoint.
 *
 * @swagger
 * tags:
 *   name: Auth
 *   description: Google OAuth 2.0 authentication
 */
import { Router, Request, Response } from "express";
import passport from "passport";
import { verifyToken } from "../middleware/auth";

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

/**
 * @swagger
 * /api/v1/auth/google:
 *   get:
 *     summary: Redirect to Google OAuth
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to Google sign-in
 */
router.get(
    "/google",
    passport.authenticate("google", { scope: ["profile", "email"], session: false }),
);

/**
 * @swagger
 * /api/v1/auth/google/callback:
 *   get:
 *     summary: Google OAuth callback – issues JWT
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       302:
 *         description: Redirect to frontend with token in query string
 *       401:
 *         description: Authentication failed
 */
router.get(
    "/google/callback",
    passport.authenticate("google", { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
    (req: Request, res: Response) => {
        const token = (req.user as { token: string } | undefined)?.token;
        if (!token) {
            res.redirect(`${FRONTEND_URL}/login?error=token_missing`);
            return;
        }
        res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);
    },
);

/**
 * @swagger
 * /api/v1/auth/me:
 *   get:
 *     summary: Return current authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User object
 *       401:
 *         description: Unauthorized
 */
router.get("/me", verifyToken, (req: Request, res: Response) => {
    res.json({ status: "success", data: req.user });
});

export default router;

/**
 * auth.ts  (middleware)
 * JWT bearer token verification middleware.
 *
 * Usage: apply verifyToken to any router that requires authentication.
 * Sets req.user = { userId, email, name } on success.
 */
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "change_me_in_production";

export interface AuthUser {
    userId: string;
    email: string;
    name: string;
}

// Augment passport's Express.User to include our JWT payload fields.
// Passport already adds req.user?: Express.User, so we extend that interface.
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace Express {
        interface User extends AuthUser { }
    }
}

export function verifyToken(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        res.status(401).json({ status: "error", code: "UNAUTHORIZED", message: "Missing or malformed Authorization header." });
        return;
    }

    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, JWT_SECRET) as AuthUser;
        req.user = payload;
        next();
    } catch {
        res.status(401).json({ status: "error", code: "TOKEN_INVALID", message: "Invalid or expired JWT." });
    }
}

/**
 * CLARA Backend - Express application entry point
 *
 * Mounts:
 *   GET  /health              -> health check
 *   GET  /api/docs            -> Swagger UI
 *   GET  /api/v1/auth/google  -> OAuth redirect
 *   POST /api/v1/document/analyze -> async OCR (queued, returns 202)
 *   POST /api/v1/contract/review  -> Scan & Explain pipeline
 *   POST /api/v1/query           -> Legal Q&A
 *   POST /api/v1/drafter/chat    -> Smart Document Drafter
 */
import express from "express";
import cors from "cors";
import session from "express-session";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { getDriver, verifyConnectivity } from "./config/neo4j";
import { initSchema } from "./scripts/initSchema";
import { swaggerSpec } from "./config/swagger";
import { configuredPassport } from "./config/passport";
import contractRouter from "./routes/contract";
import documentRouter from "./routes/document";
import queryRouter from "./routes/query";
import drafterRouter from "./routes/drafter";
import authRouter from "./routes/auth";
import chatRouter from "./routes/chat";
import { verifyToken } from "./middleware/auth";
import { seedKnowledge } from "./scripts/seedKnowledge";
// Start the analysis worker (side-effect import)
import "./workers/analysisWorker";

const app = express();
// app.set('trust proxy', 1);

// Middleware
app.use(
    cors({
        origin: [env.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000", "https://clara-ai-nine.vercel.app"],
        methods: ["GET", "POST", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
    }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Required by passport even when we don't persist sessions (JWT-only flows)
app.use(
    session({
        secret: env.JWT_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: env.NODE_ENV === "production" },
    }),
);
app.use(configuredPassport.initialize());

// Health check     
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "CLARA Backend",
        version: "1.0.0",
        timestamp: new Date().toISOString(),
    });
});

// Swagger UI
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "CLARA API Docs",
}));

// Auth routes(public)   ─
app.use("/api/v1/auth", authRouter);

// Protected API routes   ─
// verifyToken is applied here but document.ts still accepts without auth as fallback
app.use("/api/v1/contract", verifyToken, contractRouter);
app.use("/api/v1/document", documentRouter); // Auth optional – worker handles userId
app.use("/api/v1/query", verifyToken, queryRouter);
app.use("/api/v1/drafter", verifyToken, drafterRouter);
app.use("/api/v1/chat", verifyToken, chatRouter);

// 404    
app.use((_req, res) => {
    res.status(404).json({ status: "error", code: "NOT_FOUND", message: "Route not found" });
});

// Global error handler — catches Multer errors (file too large, wrong type),
// unhandled async rejections from Express 5, and any other middleware errors.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[unhandled]", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    const code = err instanceof Error && "code" in err ? (err as any).code : "INTERNAL_ERROR";
    res.status(500).json({ status: "error", code, message });
});

// Startup   ─
async function start(): Promise<void> {
    try {
        await verifyConnectivity();
        await initSchema();
        console.log("✅ Schema ready.");

        // Auto-seed knowledge graph if empty (first-time setup)
        const checkSession = getDriver().session();
        try {
            const countResult = await checkSession.run(
                "MATCH (n) WHERE n:Article OR n:LegalConcept RETURN count(*) AS cnt",
            );
            const count = countResult.records[0]?.get("cnt")?.toNumber() ?? 0;
            if (count === 0) {
                console.log("🌱 Knowledge graph is empty — seeding...");
                await seedKnowledge();
                // Refresh fulltext index so BM25 immediately finds the seeded data
                try {
                    await checkSession.run("CALL db.index.fulltext.awaitEventuallyConsistentIndexRefresh()");
                } catch { /* older Neo4j versions may not have this procedure */ }
                console.log("✅ Knowledge graph seeded.");
            } else {
                console.log(`ℹ️  Knowledge graph already has ${count} nodes.`);
            }
        } finally {
            await checkSession.close();
        }
    } catch (err) {
        console.warn("Neo4j not available on startup — vector search will return empty results.");
        console.warn("Run: docker-compose up -d to start Neo4j.");
    }

    app.listen(env.PORT, () => {
        console.log(`CLARA backend running on http://localhost:${env.PORT}`);
        console.log(`Environment: ${env.NODE_ENV}`);
        console.log("");
        console.log("Endpoints:");
        console.log(`GET  http://localhost:${env.PORT}/health`);
        console.log(`GET  http://localhost:${env.PORT}/api/docs  ← Swagger UI`);
        console.log(`GET  http://localhost:${env.PORT}/api/v1/auth/google`);
        console.log(`POST http://localhost:${env.PORT}/api/v1/document/analyze  (→ 202 queued)`);
        console.log(`POST http://localhost:${env.PORT}/api/v1/contract/review`);
        console.log(`POST http://localhost:${env.PORT}/api/v1/query`);
        console.log(`POST http://localhost:${env.PORT}/api/v1/drafter/chat`);
    });
}

start();
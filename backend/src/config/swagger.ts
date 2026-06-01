/**
 * swagger.ts
 * API documentation config using swagger-jsdoc.
 * Mounted at GET /api/docs in index.ts.
 */
import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "CLARA – Contract & Legal AI Reasoning Assistant",
            version: "1.0.0",
            description:
                "REST API for CLARA: OCR-powered contract analysis, Legal Q&A, Document drafter, and more.",
        },
        servers: [
            { url: "http://localhost:3001", description: "Local development" },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
        security: [{ bearerAuth: [] }],
    },
    apis: ["./src/routes/*.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);

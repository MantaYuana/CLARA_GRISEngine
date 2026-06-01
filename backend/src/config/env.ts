import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`missing required env var: ${key}`);
  }
  return value;
}

export const env = {
  PORT: parseInt(process.env.PORT ?? "3001", 10),
  NODE_ENV: process.env.NODE_ENV ?? "development",

  // Neo4j
  NEO4J_URI: requireEnv("NEO4J_URI"),
  NEO4J_USER: requireEnv("NEO4J_USER"),
  NEO4J_PASSWORD: requireEnv("NEO4J_PASSWORD"),

  // Google AI / Gemini
  GOOGLE_AI_API_KEY: requireEnv("GOOGLE_AI_API_KEY"),
  GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  EMBEDDING_MODEL: process.env.EMBEDDING_MODEL ?? "gemini-embedding-001",
  EMBEDDING_DIMENSION: parseInt(process.env.EMBEDDING_DIMENSION ?? "768", 10),

  // Reasoning pipeline
  REASONING_PATHS: parseInt(process.env.REASONING_PATHS ?? "3", 10),
  TEMPERATURE_LOW: parseFloat(process.env.TEMPERATURE_LOW ?? "0.1"),
  TEMPERATURE_HIGH: parseFloat(process.env.TEMPERATURE_HIGH ?? "0.7"),
  MAX_CONTEXT_TOKENS: parseInt(process.env.MAX_CONTEXT_TOKENS ?? "8192", 10),

  // Hybrid retrieval weights
  TOP_K_DENSE: parseInt(process.env.TOP_K_DENSE ?? "5", 10),
  TOP_K_BM25: parseInt(process.env.TOP_K_BM25 ?? "5", 10),
  TOP_K_SYMBOLIC: parseInt(process.env.TOP_K_SYMBOLIC ?? "5", 10),
  HYBRID_DENSE_WEIGHT: parseFloat(process.env.HYBRID_DENSE_WEIGHT ?? "0.5"),
  HYBRID_BM25_WEIGHT: parseFloat(process.env.HYBRID_BM25_WEIGHT ?? "0.3"),
  HYBRID_SYMBOLIC_WEIGHT: parseFloat(process.env.HYBRID_SYMBOLIC_WEIGHT ?? "0.2"),

  // File upload
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB ?? "10", 10),
  UPLOAD_DIR: process.env.UPLOAD_DIR ?? "./uploads",

  // OAuth + JWT (Module 2)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? process.env.OAUTH_GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? process.env.OAUTH_GOOGLE_CLIENT_SECRET ?? "",
  JWT_SECRET: process.env.JWT_SECRET ?? "change_me_in_production",
  FRONTEND_URL: process.env.FRONTEND_URL ?? "http://localhost:5173",

  // Queue (Module 4)
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",

  // Drafter (Module 5)
  DRAFTER_MIN_CONFIDENCE: parseFloat(process.env.DRAFTER_MIN_CONFIDENCE ?? "0.8"),
};

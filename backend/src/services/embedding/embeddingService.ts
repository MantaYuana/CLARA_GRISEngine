/**
 * embeddingService.ts
 * Generates vector embeddings using Google's gemini-embedding-001 model
 * (768 dimensions, optimised for semantic similarity / retrieval tasks).
 */
import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { env } from "../../config/env";

const genAI = new GoogleGenerativeAI(env.GOOGLE_AI_API_KEY);

// Rate-limit helper: 200 ms between calls
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Embed a single text string.
 * @param text Input text (truncated to ~8 192 tokens by the API)
 * @param taskType RETRIEVAL_DOCUMENT for indexing, RETRIEVAL_QUERY for queries
 */
export async function embedText(
  text: string,
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT,
): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: env.EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { parts: [{ text }], role: "user" },
    taskType,
  });
  return result.embedding.values;
}

/**
 * Embed multiple texts sequentially with 200 ms delay to respect rate limits.
 */
export async function embedBatch(
  texts: string[],
  taskType: TaskType = TaskType.RETRIEVAL_DOCUMENT,
): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await embedText(text, taskType));
    await sleep(200);
  }
  return embeddings;
}

/**
 * embeddingService.ts
 * Generates vector embeddings using a locally-running Hugging Face Transformers.js
 * pipeline (ONNX Runtime, fully offline — no external API calls).
 *
 * Model: Xenova/multilingual-e5-base (768 dimensions)
 * Produces dense semantic vectors suitable for cosine-similarity search in Neo4j.
 * The model is lazy-loaded on first call and reused as a singleton thereafter.
 *
 * Compatible with the existing Neo4j vector indexes (768-dim cosine) created by
 * initSchema.ts — no index rebuild is required when switching from Gemini.
 */
import { pipeline, FeatureExtractionPipeline } from "@huggingface/transformers";
import { env } from "../../config/env";

let extractor: FeatureExtractionPipeline | null = null;

/**
 * Lazy-load the embedding model pipeline.
 * The ONNX model files are cached to disk after the first download (~130 MB).
 */
async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    const modelName = env.EMBEDDING_MODEL;
    console.log(`[Embedding] Loading model: ${modelName}`);
    extractor = await pipeline("feature-extraction", modelName, {
      dtype: "fp32",
    }) as FeatureExtractionPipeline;
    console.log(`[Embedding] Model loaded.`);
  }
  return extractor;
}

// Rate-limit helper: small delay between batch calls to avoid CPU starvation
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Embed a single text string and return a flat number[] vector.
 *
 * Mean-pooling + L2 normalisation is applied so that cosine similarity
 * equals dot-product, matching Neo4j's vector index similarity function.
 *
 * @param text  Input text (truncated to model's max token limit internally)
 */
export async function embedText(text: string): Promise<number[]> {
  const extract = await getExtractor();

  // mean pooling + L2 normalize → standard semantic embedding
  const output = await extract(text, { pooling: "mean", normalize: true });

  // output.data is a Float32Array; convert to plain number[]
  return Array.from(output.data as Float32Array);
}

/**
 * Embed multiple texts sequentially with a 300 ms delay between calls
 * to avoid saturating the CPU during bulk seeding operations.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (const text of texts) {
    embeddings.push(await embedText(text));
    await sleep(300);
  }
  return embeddings;
}

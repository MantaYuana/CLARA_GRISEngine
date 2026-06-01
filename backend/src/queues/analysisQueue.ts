/**
 * analysisQueue.ts
 * BullMQ Queue for async document analysis jobs.
 *
 * Payload shape:
 *   { documentId, userId, bufferBase64, mimeType }
 */
import { Queue } from "bullmq";
import { getRedis } from "../config/redis";

export interface AnalysisJob {
    documentId: string;
    userId: string;
    bufferBase64: string; // base64-encoded file buffer
    mimeType: string;
}

export const analysisQueue = new Queue<AnalysisJob>("document-analysis", {
    connection: getRedis(),
    defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { age: 3600, count: 200 }, // keep for 1 h
        removeOnFail: { age: 86400 },                 // keep for 1 day
    },
});

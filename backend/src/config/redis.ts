/**
 * redis.ts
 * IORedis singleton shared by BullMQ Queue and Worker.
 * Read connection URL from REDIS_URL env var.
 */
import IORedis from "ioredis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

let _redis: IORedis | null = null;

export function getRedis(): IORedis {
    if (!_redis) {
        _redis = new IORedis(REDIS_URL, {
            maxRetriesPerRequest: null, // required by BullMQ
            enableReadyCheck: false,
        });
        _redis.on("error", (err) => {
            console.warn("[Redis] connection error:", err.message);
        });
    }
    return _redis;
}

export async function closeRedis(): Promise<void> {
    if (_redis) {
        await _redis.quit();
        _redis = null;
    }
}

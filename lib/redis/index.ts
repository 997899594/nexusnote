/**
 * Redis Client Singleton
 *
 * Uses ioredis with lazyConnect to avoid connections during build.
 * Follows the same globalThis pattern as db/index.ts for HMR safety.
 */

import Redis from "ioredis";
import { env } from "@/config/env";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  return new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

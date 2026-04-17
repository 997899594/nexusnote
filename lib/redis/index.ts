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
  const client = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null, // required by BullMQ
    enableReadyCheck: false,
  });

  client.on("error", (error) => {
    if (env.APP_TRACE_LOGS) {
      console.warn("[Redis] Connection error:", error);
    }
  });

  return client;
}

export function getRedis(): Redis {
  if (globalForRedis.redis) {
    return globalForRedis.redis;
  }

  const client = createRedisClient();

  if (env.NODE_ENV !== "production") {
    globalForRedis.redis = client;
  }

  return client;
}

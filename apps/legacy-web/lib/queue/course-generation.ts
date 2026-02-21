/**
 * Course Generation Queue — BullMQ 队列定义
 *
 * 用于 API 路由中入队课程生成任务。
 * Worker 端在 src/queue/worker.ts 中消费。
 */

import { env } from "@nexusnote/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const redis = new IORedis(env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

export interface CourseGenerationJobData {
  courseId: string; // courseProfiles.id（同时也是 sessionId）
  userId: string;
}

export interface CourseGenerationProgress {
  current: number;
  total: number;
  status: "generating" | "completed" | "failed";
  chapterTitle?: string;
}

export const courseGenerationQueue = new Queue<CourseGenerationJobData>("course-generation", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

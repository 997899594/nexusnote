import { env } from "@/config/env";

export type QueueRuntimePolicyName =
  | "learningOutbox"
  | "analyticsOutbox"
  | "courseProduction"
  | "careerTree"
  | "knowledgeInsights"
  | "noteFollowups"
  | "rag"
  | "research";

export interface QueueRuntimePolicy {
  concurrency: number;
  attempts: number;
  backoffDelay: number;
}

export function getQueueRuntimePolicy(name: QueueRuntimePolicyName): QueueRuntimePolicy {
  switch (name) {
    case "learningOutbox":
      return {
        concurrency: env.QUEUE_LEARNING_OUTBOX_CONCURRENCY,
        attempts: env.QUEUE_LEARNING_OUTBOX_MAX_RETRIES,
        backoffDelay: env.QUEUE_LEARNING_OUTBOX_BACKOFF_DELAY,
      };
    case "analyticsOutbox":
      return {
        concurrency: env.QUEUE_ANALYTICS_OUTBOX_CONCURRENCY,
        attempts: env.QUEUE_ANALYTICS_OUTBOX_MAX_RETRIES,
        backoffDelay: env.QUEUE_ANALYTICS_OUTBOX_BACKOFF_DELAY,
      };
    case "courseProduction":
      return {
        concurrency: env.QUEUE_COURSE_PRODUCTION_CONCURRENCY,
        attempts: env.QUEUE_COURSE_PRODUCTION_MAX_RETRIES,
        backoffDelay: env.QUEUE_COURSE_PRODUCTION_BACKOFF_DELAY,
      };
    case "careerTree":
      return {
        concurrency: env.QUEUE_CAREER_TREE_CONCURRENCY,
        attempts: env.QUEUE_CAREER_TREE_MAX_RETRIES,
        backoffDelay: env.QUEUE_CAREER_TREE_BACKOFF_DELAY,
      };
    case "knowledgeInsights":
      return {
        concurrency: env.QUEUE_KNOWLEDGE_INSIGHTS_CONCURRENCY,
        attempts: env.QUEUE_KNOWLEDGE_INSIGHTS_MAX_RETRIES,
        backoffDelay: env.QUEUE_KNOWLEDGE_INSIGHTS_BACKOFF_DELAY,
      };
    case "noteFollowups":
      return {
        concurrency: env.QUEUE_NOTE_FOLLOWUPS_CONCURRENCY,
        attempts: env.QUEUE_NOTE_FOLLOWUPS_MAX_RETRIES,
        backoffDelay: env.QUEUE_NOTE_FOLLOWUPS_BACKOFF_DELAY,
      };
    case "rag":
      return {
        concurrency: env.QUEUE_RAG_CONCURRENCY,
        attempts: env.QUEUE_RAG_MAX_RETRIES,
        backoffDelay: env.QUEUE_RAG_BACKOFF_DELAY,
      };
    case "research":
      return {
        concurrency: env.QUEUE_RESEARCH_CONCURRENCY,
        attempts: env.QUEUE_RESEARCH_MAX_RETRIES,
        backoffDelay: env.QUEUE_RESEARCH_BACKOFF_DELAY,
      };
  }
}

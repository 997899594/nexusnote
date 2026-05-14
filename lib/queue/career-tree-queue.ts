import { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { getRedis } from "@/lib/redis";

export type CareerTreeJobData =
  | {
      type: "extract_course_evidence";
      userId: string;
      courseId: string;
    }
  | {
      type: "merge_user_skill_graph";
      userId: string;
      courseId: string;
      extractRunId?: string;
    }
  | {
      type: "compose_user_career_trees";
      userId: string;
    }
  | {
      type: "refresh_user_career_tree_snapshot";
      userId: string;
      courseId?: string;
      reasonKey?: string;
    };

let careerTreeQueue: Queue<CareerTreeJobData> | null = null;

export function getCareerTreeQueue(): Queue<CareerTreeJobData> {
  if (careerTreeQueue) {
    return careerTreeQueue;
  }

  careerTreeQueue = new Queue<CareerTreeJobData>("career-tree", {
    connection: getRedis() as never,
    defaultJobOptions: {
      attempts: defaults.queue.careerTreeMaxRetries,
      backoff: {
        type: "exponential",
        delay: defaults.queue.careerTreeBackoffDelay,
      },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  return careerTreeQueue;
}

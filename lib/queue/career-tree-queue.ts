import type { Queue } from "bullmq";
import { defaults } from "@/config/env";
import { createNexusQueue } from "@/lib/queue/bullmq";

export type CareerTreeJobData =
  | {
      type: "extract_course_evidence";
      userId: string;
      courseId: string;
      requestKey?: string;
    }
  | {
      type: "merge_user_skill_graph";
      userId: string;
      courseId: string;
      extractRunId?: string;
      requestKey?: string;
    }
  | {
      type: "compose_user_career_trees";
      userId: string;
      requestKey?: string;
    }
  | {
      type: "refresh_user_career_tree_snapshot";
      userId: string;
      courseId?: string;
      reasonKey?: string;
      requestKey?: string;
    };

let careerTreeQueue: Queue<CareerTreeJobData> | null = null;

export function getCareerTreeQueue(): Queue<CareerTreeJobData> {
  if (careerTreeQueue) {
    return careerTreeQueue;
  }

  careerTreeQueue = createNexusQueue<CareerTreeJobData>("career-tree", {
    attempts: defaults.queue.careerTreeMaxRetries,
    backoffDelay: defaults.queue.careerTreeBackoffDelay,
  });

  return careerTreeQueue;
}

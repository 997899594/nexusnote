import { Queue } from "bullmq";
import { redis } from "@/lib/redis";

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
    };

export const careerTreeQueue = new Queue<CareerTreeJobData>("career-tree", {
  connection: redis as never,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

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
      affectedNodeIds?: string[];
    }
  | {
      type: "merge_knowledge_source_evidence";
      userId: string;
      sourceType: string;
      sourceId: string;
      sourceVersionHash?: string | null;
      affectedNodeIds?: string[];
    }
  | {
      type: "compose_user_career_trees";
      userId: string;
    }
  | {
      type: "refresh_user_skill_graph";
      userId: string;
      courseId?: string;
      nodeIds?: string[];
    }
  | {
      type: "derive_user_insights";
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

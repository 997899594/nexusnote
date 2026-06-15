import type { Worker } from "bullmq";
import { defaults } from "@/config/env";
import { and, careerGenerationRuns, careerUserTreeSnapshots, db, eq, ne } from "@/db";
import {
  recomputeAllCareerNodeAggregatesForUser,
  recomputeCareerNodesForCourse,
} from "@/lib/career-tree/aggregation";
import { processCareerTreeComposeJob } from "@/lib/career-tree/compose";
import {
  CAREER_TREE_COMPOSE_PROMPT_VERSION,
  CAREER_TREE_SCHEMA_VERSION,
} from "@/lib/career-tree/constants";
import { processCareerTreeExtractJob } from "@/lib/career-tree/extract";
import { processCareerTreeMergeJob } from "@/lib/career-tree/merge";
import {
  enqueueCareerTreeCompose,
  enqueueCareerTreeExtract,
  enqueueCareerTreeRefresh,
} from "@/lib/career-tree/queue";
import { listCareerCourseSourcesForUser } from "@/lib/career-tree/source";
import { createNexusWorker } from "./bullmq";
import type { CareerTreeJobData } from "./career-tree-queue";

let worker: Worker<CareerTreeJobData> | null = null;

async function enqueueOutdatedCareerTreeRefreshJobs(): Promise<void> {
  const rows = await db
    .selectDistinct({
      userId: careerUserTreeSnapshots.userId,
    })
    .from(careerUserTreeSnapshots)
    .leftJoin(
      careerGenerationRuns,
      eq(careerUserTreeSnapshots.composeRunId, careerGenerationRuns.id),
    )
    .where(
      and(
        eq(careerUserTreeSnapshots.isLatest, true),
        eq(careerUserTreeSnapshots.schemaVersion, CAREER_TREE_SCHEMA_VERSION),
        eq(careerUserTreeSnapshots.status, "ready"),
        ne(careerGenerationRuns.promptVersion, CAREER_TREE_COMPOSE_PROMPT_VERSION),
      ),
    );

  for (const row of rows) {
    await enqueueCareerTreeRefresh({
      userId: row.userId,
      reasonKey: CAREER_TREE_COMPOSE_PROMPT_VERSION,
    });
  }

  if (rows.length > 0) {
    console.log(`[CareerTreeWorker] Queued outdated career tree refresh jobs: ${rows.length}`);
  }
}

async function processCareerTreeRefreshJob(
  job: Extract<CareerTreeJobData, { type: "refresh_user_career_tree_snapshot" }>,
): Promise<void> {
  const courseSources = await listCareerCourseSourcesForUser({
    userId: job.userId,
    courseId: job.courseId,
  });

  if (job.courseId) {
    await recomputeCareerNodesForCourse({
      userId: job.userId,
      courseId: job.courseId,
    });
  } else {
    await recomputeAllCareerNodeAggregatesForUser(job.userId);
  }

  if (courseSources.length === 0) {
    await enqueueCareerTreeCompose(job.userId, job.requestKey);
    return;
  }

  for (const source of courseSources) {
    await enqueueCareerTreeExtract(source.userId, source.courseId, job.requestKey);
  }
}

function getCareerTreeFailureOptions(job: { attemptsMade: number; opts: { attempts?: number } }) {
  const attemptNumber = job.attemptsMade + 1;
  const maxAttempts = job.opts.attempts ?? 1;

  return {
    final: attemptNumber >= maxAttempts,
    attemptNumber,
    maxAttempts,
  };
}

export function startCareerTreeWorker(): Worker<CareerTreeJobData> {
  if (worker) {
    return worker;
  }

  worker = createNexusWorker<CareerTreeJobData>(
    "career-tree",
    async (job) => {
      const failure = getCareerTreeFailureOptions(job);

      switch (job.data.type) {
        case "extract_course_evidence":
          await processCareerTreeExtractJob({ ...job.data, failure });
          break;
        case "merge_user_skill_graph":
          await processCareerTreeMergeJob({ ...job.data, failure });
          break;
        case "compose_user_career_trees":
          await processCareerTreeComposeJob({ ...job.data, failure });
          break;
        case "refresh_user_career_tree_snapshot":
          await processCareerTreeRefreshJob(job.data);
          break;
      }
    },
    {
      label: "CareerTreeWorker",
      concurrency: defaults.queue.careerTreeConcurrency,
    },
  );

  void enqueueOutdatedCareerTreeRefreshJobs().catch((error) => {
    console.error("[CareerTreeWorker] Failed to queue outdated career tree refresh jobs", error);
  });

  return worker;
}

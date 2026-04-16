import { createHash } from "node:crypto";
import type { EvidenceMergeRow } from "@/lib/growth/data-access";
import { enqueueGrowthCompose } from "@/lib/growth/queue";
import type { GrowthJobData } from "@/lib/queue/growth-queue";

export type JobPayload<T extends GrowthJobData["type"]> = Extract<GrowthJobData, { type: T }>;

export interface GrowthJobExecutionOptions {
  enqueueFollowups?: boolean;
}

export function computeEvidenceBatchHash(rows: EvidenceMergeRow[]): string {
  return createHash("sha256")
    .update(
      rows
        .map(
          (row) =>
            `${row.id}:${row.title}:${row.summary}:${row.confidence}:${row.sourceVersionHash ?? ""}`,
        )
        .join("|"),
    )
    .digest("hex");
}

export function computeGrowthRefreshInputHash(params: {
  courseId?: string;
  nodeIds: string[];
  reasonKey?: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        courseId: params.courseId ?? null,
        nodeIds: [...params.nodeIds].sort(),
        reasonKey: params.reasonKey ?? null,
      }),
    )
    .digest("hex");
}

export async function enqueueGrowthProjectionRefresh(userId: string): Promise<void> {
  await enqueueGrowthCompose(userId);
}

export function dedupeNodeIds(nodeIds: string[]): string[] {
  return [...new Set(nodeIds)];
}

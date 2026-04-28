import {
  enqueueGrowthRefresh,
  enqueueKnowledgeInsights,
  enqueueKnowledgeSourceMerge,
} from "@/lib/growth/queue";
import { deleteEvidenceEventsBySource } from "@/lib/knowledge/events";
import { aggregateSourceEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence/aggregate";
import { listLinkedNodeIdsForEvidenceSource } from "@/lib/knowledge/evidence/selectors";

interface SyncKnowledgeSourceParams {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
  hasContent: boolean;
  clearReason: string;
  replaceEvents?: () => Promise<void>;
  syncChunks?: () => Promise<SyncKnowledgeSourceChunkResult>;
  enqueueInsightsOnEmpty?: boolean;
  enqueueFollowups?: boolean;
}

export interface SyncKnowledgeSourceChunkResult {
  success: boolean;
  chunksCount: number;
  evidenceCount: number;
}

export interface SyncKnowledgeSourceResult {
  affectedNodeIds: string[];
  sourceVersionHash: string | null;
  hasContent: boolean;
  enqueuedFollowups: boolean;
  chunks: SyncKnowledgeSourceChunkResult | null;
}

async function enqueueSyncKnowledgeSourceFollowups(
  params: SyncKnowledgeSourceParams,
  affectedNodeIds: string[],
  sourceVersionHash: string | null,
): Promise<void> {
  if (params.hasContent) {
    await enqueueKnowledgeSourceMerge({
      userId: params.userId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceVersionHash,
      affectedNodeIds,
    });
    return;
  }

  if (affectedNodeIds.length > 0) {
    await enqueueGrowthRefresh(params.userId, undefined, affectedNodeIds, params.clearReason);
    return;
  }

  if (params.enqueueInsightsOnEmpty ?? true) {
    await enqueueKnowledgeInsights(params.userId);
  }
}

export async function syncKnowledgeSource(
  params: SyncKnowledgeSourceParams,
): Promise<SyncKnowledgeSourceResult> {
  const sourceVersionHash = params.sourceVersionHash ?? null;
  const affectedNodeIds = await listLinkedNodeIdsForEvidenceSource({
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceVersionHash,
  });

  await deleteEvidenceEventsBySource({
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceVersionHash,
  });

  if (params.hasContent) {
    await params.replaceEvents?.();
  }

  await aggregateSourceEventsToKnowledgeEvidence({
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceVersionHash,
  });

  let chunks: SyncKnowledgeSourceChunkResult | null = null;
  if (params.hasContent) {
    chunks = (await params.syncChunks?.()) ?? null;
  }

  const enqueuedFollowups = params.enqueueFollowups ?? true;
  if (enqueuedFollowups) {
    await enqueueSyncKnowledgeSourceFollowups(params, affectedNodeIds, sourceVersionHash);
  }

  return {
    affectedNodeIds,
    sourceVersionHash,
    hasContent: params.hasContent,
    enqueuedFollowups,
    chunks,
  };
}

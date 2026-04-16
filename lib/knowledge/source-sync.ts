import {
  enqueueGrowthRefresh,
  enqueueKnowledgeInsights,
  enqueueKnowledgeSourceMerge,
} from "@/lib/growth/queue";
import { deleteEvidenceEventsBySource } from "@/lib/knowledge/events";
import {
  aggregateSourceEventsToKnowledgeEvidence,
  listLinkedNodeIdsForEvidenceSource,
} from "@/lib/knowledge/evidence";

interface SyncKnowledgeSourceParams {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
  hasContent: boolean;
  clearReason: string;
  replaceEvents?: () => Promise<void>;
  syncChunks?: () => Promise<void>;
  enqueueInsightsOnEmpty?: boolean;
}

export async function syncKnowledgeSource(params: SyncKnowledgeSourceParams): Promise<string[]> {
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

  if (params.replaceEvents) {
    await params.replaceEvents();
  }

  await aggregateSourceEventsToKnowledgeEvidence({
    userId: params.userId,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    sourceVersionHash,
  });

  if (params.syncChunks) {
    await params.syncChunks();
  }

  if (params.hasContent) {
    await enqueueKnowledgeSourceMerge({
      userId: params.userId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceVersionHash,
      affectedNodeIds,
    });
    return affectedNodeIds;
  }

  if (affectedNodeIds.length > 0) {
    await enqueueGrowthRefresh(params.userId, undefined, affectedNodeIds, params.clearReason);
    return affectedNodeIds;
  }

  if (params.enqueueInsightsOnEmpty ?? true) {
    await enqueueKnowledgeInsights(params.userId);
  }

  return affectedNodeIds;
}

import { deleteEvidenceEventsBySource } from "@/lib/knowledge/events";
import { aggregateSourceEventsToKnowledgeEvidence } from "@/lib/knowledge/evidence/aggregate";
import { enqueueKnowledgeInsights } from "@/lib/knowledge/insights/queue";

interface SyncKnowledgeSourceParams {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
  hasContent: boolean;
  replaceEvents?: () => Promise<void>;
  syncChunks?: () => Promise<SyncKnowledgeSourceChunkResult>;
  enqueueFollowups?: boolean;
}

export interface SyncKnowledgeSourceChunkResult {
  success: boolean;
  chunksCount: number;
  evidenceCount: number;
}

export interface SyncKnowledgeSourceResult {
  sourceVersionHash: string | null;
  hasContent: boolean;
  enqueuedFollowups: boolean;
  chunks: SyncKnowledgeSourceChunkResult | null;
}

async function enqueueSyncKnowledgeSourceFollowups(
  params: SyncKnowledgeSourceParams,
): Promise<void> {
  await enqueueKnowledgeInsights(params.userId);
}

export async function syncKnowledgeSource(
  params: SyncKnowledgeSourceParams,
): Promise<SyncKnowledgeSourceResult> {
  const sourceVersionHash = params.sourceVersionHash ?? null;

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
    await enqueueSyncKnowledgeSourceFollowups(params);
  }

  return {
    sourceVersionHash,
    hasContent: params.hasContent,
    enqueuedFollowups,
    chunks,
  };
}

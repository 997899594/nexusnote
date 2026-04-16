import { and, eq, isNull } from "drizzle-orm";
import { db, knowledgeEvidenceEventRefs, knowledgeEvidenceEvents } from "@/db";
import type { EvidenceEvent, EvidenceEventRef } from "./types";

type IngestEvidenceEventRef = Omit<EvidenceEventRef, "eventId">;

export interface IngestEvidenceEventInput extends EvidenceEvent {
  refs?: IngestEvidenceEventRef[];
}

function buildSourceVersionCondition(
  sourceVersionHash: string | null | undefined,
  field: typeof knowledgeEvidenceEvents.sourceVersionHash,
) {
  return sourceVersionHash == null ? isNull(field) : eq(field, sourceVersionHash);
}

export async function ingestEvidenceEvent(input: IngestEvidenceEventInput): Promise<string> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(knowledgeEvidenceEvents)
      .values({
        id: input.id,
        userId: input.userId,
        kind: input.kind,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceVersionHash: input.sourceVersionHash,
        title: input.title,
        summary: input.summary,
        confidence: input.confidence.toFixed(3),
        happenedAt: new Date(input.happenedAt),
        metadata: input.metadata,
      })
      .returning({ id: knowledgeEvidenceEvents.id });

    if (input.refs && input.refs.length > 0) {
      await tx.insert(knowledgeEvidenceEventRefs).values(
        input.refs.map((ref) => ({
          eventId: event.id,
          refType: ref.refType,
          refId: ref.refId,
          snippet: ref.snippet ?? null,
          weight: ref.weight.toFixed(3),
        })),
      );
    }

    return event.id;
  });
}

export async function deleteEvidenceEventsBySource(input: {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
}): Promise<void> {
  await db
    .delete(knowledgeEvidenceEvents)
    .where(
      and(
        eq(knowledgeEvidenceEvents.userId, input.userId),
        eq(knowledgeEvidenceEvents.sourceType, input.sourceType),
        eq(knowledgeEvidenceEvents.sourceId, input.sourceId),
        buildSourceVersionCondition(
          input.sourceVersionHash,
          knowledgeEvidenceEvents.sourceVersionHash,
        ),
      ),
    );
}

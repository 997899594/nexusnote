import { db, knowledgeEvidenceEventRefs, knowledgeEvidenceEvents } from "@/db";
import type { EvidenceEvent, EvidenceEventRef } from "./types";

type IngestEvidenceEventRef = Omit<EvidenceEventRef, "eventId">;

export interface IngestEvidenceEventInput extends EvidenceEvent {
  refs?: IngestEvidenceEventRef[];
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

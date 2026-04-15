import { and, desc, eq, inArray } from "drizzle-orm";
import { db, knowledgeEvidenceEventRefs, knowledgeEvidenceEvents } from "@/db";
import {
  type EvidenceEventKind,
  type EvidenceEventWithRefs,
  evidenceEventWithRefsSchema,
} from "./types";

export interface ListEvidenceEventsOptions {
  limit?: number;
  kind?: EvidenceEventKind;
  sourceType?: string;
  sourceId?: string;
}

export async function listEvidenceEventsForUser(
  userId: string,
  options: ListEvidenceEventsOptions = {},
): Promise<EvidenceEventWithRefs[]> {
  const { limit, kind, sourceType, sourceId } = options;
  const query = db
    .select({
      id: knowledgeEvidenceEvents.id,
      userId: knowledgeEvidenceEvents.userId,
      kind: knowledgeEvidenceEvents.kind,
      sourceType: knowledgeEvidenceEvents.sourceType,
      sourceId: knowledgeEvidenceEvents.sourceId,
      sourceVersionHash: knowledgeEvidenceEvents.sourceVersionHash,
      title: knowledgeEvidenceEvents.title,
      summary: knowledgeEvidenceEvents.summary,
      confidence: knowledgeEvidenceEvents.confidence,
      happenedAt: knowledgeEvidenceEvents.happenedAt,
      metadata: knowledgeEvidenceEvents.metadata,
    })
    .from(knowledgeEvidenceEvents)
    .where(
      and(
        eq(knowledgeEvidenceEvents.userId, userId),
        kind ? eq(knowledgeEvidenceEvents.kind, kind) : undefined,
        sourceType ? eq(knowledgeEvidenceEvents.sourceType, sourceType) : undefined,
        sourceId ? eq(knowledgeEvidenceEvents.sourceId, sourceId) : undefined,
      ),
    )
    .orderBy(desc(knowledgeEvidenceEvents.happenedAt), desc(knowledgeEvidenceEvents.createdAt));

  const events = typeof limit === "number" ? await query.limit(limit) : await query;
  if (events.length === 0) {
    return [];
  }

  const refs = await db
    .select({
      eventId: knowledgeEvidenceEventRefs.eventId,
      refType: knowledgeEvidenceEventRefs.refType,
      refId: knowledgeEvidenceEventRefs.refId,
      snippet: knowledgeEvidenceEventRefs.snippet,
      weight: knowledgeEvidenceEventRefs.weight,
    })
    .from(knowledgeEvidenceEventRefs)
    .where(
      inArray(
        knowledgeEvidenceEventRefs.eventId,
        events.map((event) => event.id),
      ),
    );

  const refsByEventId = new Map<string, typeof refs>();
  for (const ref of refs) {
    const existing = refsByEventId.get(ref.eventId) ?? [];
    existing.push(ref);
    refsByEventId.set(ref.eventId, existing);
  }

  return events.map((event) =>
    evidenceEventWithRefsSchema.parse({
      id: event.id,
      userId: event.userId,
      kind: event.kind,
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      sourceVersionHash: event.sourceVersionHash,
      title: event.title,
      summary: event.summary,
      confidence: Number(event.confidence),
      happenedAt: event.happenedAt.toISOString(),
      metadata: event.metadata ?? {},
      refs: (refsByEventId.get(event.id) ?? []).map((ref) => ({
        eventId: ref.eventId,
        refType: ref.refType,
        refId: ref.refId,
        snippet: ref.snippet ?? null,
        weight: Number(ref.weight),
      })),
    }),
  );
}

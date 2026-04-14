import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  knowledgeEvidence,
  knowledgeEvidenceEventRefs,
  knowledgeEvidenceEvents,
  knowledgeEvidenceSourceLinks,
} from "@/db";

interface AggregateCourseEventsToEvidenceOptions {
  userId: string;
  courseId: string;
  sourceVersionHash: string;
}

export async function aggregateCourseEventsToKnowledgeEvidence({
  userId,
  courseId,
  sourceVersionHash,
}: AggregateCourseEventsToEvidenceOptions): Promise<void> {
  const events = await db
    .select({
      id: knowledgeEvidenceEvents.id,
      title: knowledgeEvidenceEvents.title,
      summary: knowledgeEvidenceEvents.summary,
      confidence: knowledgeEvidenceEvents.confidence,
      sourceType: knowledgeEvidenceEvents.sourceType,
      sourceId: knowledgeEvidenceEvents.sourceId,
      sourceVersionHash: knowledgeEvidenceEvents.sourceVersionHash,
      metadata: knowledgeEvidenceEvents.metadata,
    })
    .from(knowledgeEvidenceEvents)
    .where(
      and(
        eq(knowledgeEvidenceEvents.userId, userId),
        eq(knowledgeEvidenceEvents.sourceType, "course"),
        eq(knowledgeEvidenceEvents.sourceId, courseId),
        eq(knowledgeEvidenceEvents.sourceVersionHash, sourceVersionHash),
      ),
    );

  const extractedEvents = events.filter((event) => {
    if (!event.metadata || typeof event.metadata !== "object") {
      return false;
    }

    return "itemKind" in event.metadata;
  });

  if (extractedEvents.length === 0) {
    return;
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
        extractedEvents.map((event) => event.id),
      ),
    );

  await db.transaction(async (tx) => {
    await tx
      .delete(knowledgeEvidenceSourceLinks)
      .where(
        and(
          eq(knowledgeEvidenceSourceLinks.sourceType, "course"),
          eq(knowledgeEvidenceSourceLinks.sourceId, courseId),
        ),
      );

    await tx
      .delete(knowledgeEvidence)
      .where(
        and(
          eq(knowledgeEvidence.userId, userId),
          eq(knowledgeEvidence.sourceType, "course"),
          eq(knowledgeEvidence.sourceId, courseId),
          eq(knowledgeEvidence.sourceVersionHash, sourceVersionHash),
        ),
      );

    const insertedEvidence = [];
    for (const event of extractedEvents) {
      const [inserted] = await tx
        .insert(knowledgeEvidence)
        .values({
          userId,
          kind: "course_skill",
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          sourceVersionHash: event.sourceVersionHash,
          title: event.title,
          summary: event.summary,
          confidence: event.confidence,
        })
        .returning({
          id: knowledgeEvidence.id,
        });

      if (inserted) {
        insertedEvidence.push({
          eventId: event.id,
          evidenceId: inserted.id,
        });
      }
    }

    const evidenceIdByEventId = new Map(
      insertedEvidence.map((row) => [row.eventId, row.evidenceId]),
    );

    const sourceLinks = extractedEvents.flatMap((event) => {
      const evidenceId = evidenceIdByEventId.get(event.id);
      if (!evidenceId) {
        return [];
      }

      return refs
        .filter((ref) => ref.eventId === event.id)
        .map((ref) => ({
          evidenceId,
          sourceType: "course",
          sourceId: courseId,
          refType: ref.refType,
          refId: ref.refId,
          snippet: ref.snippet ?? null,
          weight: ref.weight,
        }));
    });

    if (sourceLinks.length > 0) {
      await tx.insert(knowledgeEvidenceSourceLinks).values(sourceLinks);
    }
  });
}

interface AggregateSourceEventsToEvidenceOptions {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
}

function buildSourceVersionCondition<T extends { sourceVersionHash: unknown }>(
  field: T["sourceVersionHash"],
  sourceVersionHash: string | null | undefined,
) {
  return sourceVersionHash == null ? isNull(field as never) : eq(field as never, sourceVersionHash);
}

export async function aggregateSourceEventsToKnowledgeEvidence({
  userId,
  sourceType,
  sourceId,
  sourceVersionHash,
}: AggregateSourceEventsToEvidenceOptions): Promise<void> {
  const events = await db
    .select({
      id: knowledgeEvidenceEvents.id,
      kind: knowledgeEvidenceEvents.kind,
      title: knowledgeEvidenceEvents.title,
      summary: knowledgeEvidenceEvents.summary,
      confidence: knowledgeEvidenceEvents.confidence,
      sourceType: knowledgeEvidenceEvents.sourceType,
      sourceId: knowledgeEvidenceEvents.sourceId,
      sourceVersionHash: knowledgeEvidenceEvents.sourceVersionHash,
    })
    .from(knowledgeEvidenceEvents)
    .where(
      and(
        eq(knowledgeEvidenceEvents.userId, userId),
        eq(knowledgeEvidenceEvents.sourceType, sourceType),
        eq(knowledgeEvidenceEvents.sourceId, sourceId),
        buildSourceVersionCondition(knowledgeEvidenceEvents.sourceVersionHash, sourceVersionHash),
      ),
    );

  const refs = await db
    .select({
      eventId: knowledgeEvidenceEventRefs.eventId,
      refType: knowledgeEvidenceEventRefs.refType,
      refId: knowledgeEvidenceEventRefs.refId,
      snippet: knowledgeEvidenceEventRefs.snippet,
      weight: knowledgeEvidenceEventRefs.weight,
    })
    .from(knowledgeEvidenceEventRefs)
    .innerJoin(
      knowledgeEvidenceEvents,
      eq(knowledgeEvidenceEventRefs.eventId, knowledgeEvidenceEvents.id),
    )
    .where(
      and(
        eq(knowledgeEvidenceEvents.userId, userId),
        eq(knowledgeEvidenceEvents.sourceType, sourceType),
        eq(knowledgeEvidenceEvents.sourceId, sourceId),
        buildSourceVersionCondition(knowledgeEvidenceEvents.sourceVersionHash, sourceVersionHash),
      ),
    );

  await db.transaction(async (tx) => {
    await tx
      .delete(knowledgeEvidenceSourceLinks)
      .where(
        and(
          eq(knowledgeEvidenceSourceLinks.sourceType, sourceType),
          eq(knowledgeEvidenceSourceLinks.sourceId, sourceId),
        ),
      );

    await tx
      .delete(knowledgeEvidence)
      .where(
        and(
          eq(knowledgeEvidence.userId, userId),
          eq(knowledgeEvidence.sourceType, sourceType),
          eq(knowledgeEvidence.sourceId, sourceId),
          buildSourceVersionCondition(knowledgeEvidence.sourceVersionHash, sourceVersionHash),
        ),
      );

    if (events.length === 0) {
      return;
    }

    const insertedEvidence = [];
    for (const event of events) {
      const [inserted] = await tx
        .insert(knowledgeEvidence)
        .values({
          userId,
          kind: event.kind,
          sourceType: event.sourceType,
          sourceId: event.sourceId,
          sourceVersionHash: event.sourceVersionHash,
          title: event.title,
          summary: event.summary,
          confidence: event.confidence,
        })
        .returning({
          id: knowledgeEvidence.id,
        });

      if (inserted) {
        insertedEvidence.push({
          eventId: event.id,
          evidenceId: inserted.id,
        });
      }
    }

    const evidenceIdByEventId = new Map(
      insertedEvidence.map((row) => [row.eventId, row.evidenceId]),
    );

    const sourceLinks = events.flatMap((event) => {
      const evidenceId = evidenceIdByEventId.get(event.id);
      if (!evidenceId) {
        return [];
      }

      return refs
        .filter((ref) => ref.eventId === event.id)
        .map((ref) => ({
          evidenceId,
          sourceType,
          sourceId,
          refType: ref.refType,
          refId: ref.refId,
          snippet: ref.snippet ?? null,
          weight: ref.weight,
        }));
    });

    if (sourceLinks.length > 0) {
      await tx.insert(knowledgeEvidenceSourceLinks).values(sourceLinks);
    }
  });
}

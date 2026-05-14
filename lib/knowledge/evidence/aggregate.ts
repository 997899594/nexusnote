import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  knowledgeEvidence,
  knowledgeEvidenceEventRefs,
  knowledgeEvidenceEvents,
  knowledgeEvidenceSourceLinks,
} from "@/db";
import {
  groupEvidenceSourceLinksByEvidenceId,
  listEvidenceSourceLinks,
} from "@/lib/knowledge/evidence/source-links";
import { buildSourceVersionCondition } from "@/lib/knowledge/source-version";

interface SelectedEvidenceEventRow {
  id: string;
  kind: string;
  title: string;
  summary: string;
  confidence: number | string;
  sourceType: string;
  sourceId: string | null;
  sourceVersionHash: string | null;
  metadata?: Record<string, unknown> | null;
}

interface AggregatedRefRow {
  refType: string;
  refId: string;
  snippet: string | null;
  weight: number | string;
}

interface SelectedEvidenceRefRow extends AggregatedRefRow {
  eventId: string;
}

interface AggregatedEvidenceRecord {
  kind: string;
  title: string;
  summary: string;
  confidence: string;
  sourceVersionHash: string | null;
  refs: Array<{
    refType: string;
    refId: string;
    snippet: string | null;
    weight: string;
  }>;
}

interface ExistingAggregatedEvidenceRecord extends AggregatedEvidenceRecord {
  id: string;
}

function normalizeConfidence(value: number | string): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return "0.500";
  }

  return Math.min(1, Math.max(0, numeric)).toFixed(3);
}

function normalizeWeight(value: number | string): string {
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) {
    return "1.000";
  }

  return Math.max(0, numeric).toFixed(3);
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function buildRefsByEventId(refs: SelectedEvidenceRefRow[]) {
  const refsByEventId = new Map<string, SelectedEvidenceRefRow[]>();

  for (const ref of refs) {
    const existing = refsByEventId.get(ref.eventId) ?? [];
    existing.push(ref);
    refsByEventId.set(ref.eventId, existing);
  }

  return refsByEventId;
}

function normalizeAggregatedRefs(refs: AggregatedRefRow[]) {
  return [...refs]
    .map((ref) => ({
      refType: ref.refType,
      refId: ref.refId,
      snippet: ref.snippet ?? null,
      weight: normalizeWeight(ref.weight),
    }))
    .sort((left, right) => {
      const leftKey = `${left.refType}:${left.refId}:${left.snippet ?? ""}:${left.weight}`;
      const rightKey = `${right.refType}:${right.refId}:${right.snippet ?? ""}:${right.weight}`;
      return leftKey.localeCompare(rightKey, "en");
    });
}

function buildGenericAggregatedEvidenceRecord(
  event: SelectedEvidenceEventRow,
  refs: SelectedEvidenceRefRow[],
): AggregatedEvidenceRecord {
  const normalizedRefs = normalizeAggregatedRefs(refs);

  return {
    kind: event.kind,
    title: event.title,
    summary: event.summary,
    confidence: normalizeConfidence(event.confidence),
    sourceVersionHash: event.sourceVersionHash,
    refs: normalizedRefs,
  };
}

function buildCourseAggregatedEvidenceRecord(
  event: SelectedEvidenceEventRow,
  refs: SelectedEvidenceRefRow[],
): AggregatedEvidenceRecord | null {
  const normalizedRefs = normalizeAggregatedRefs(refs);
  const itemKind =
    event.metadata && typeof event.metadata === "object" && "itemKind" in event.metadata
      ? event.metadata.itemKind
      : null;
  const evidenceKind =
    typeof itemKind === "string" && itemKind.length > 0
      ? "course_skill"
      : event.kind === "course_progress"
        ? "course_progress"
        : null;

  if (!evidenceKind) {
    return null;
  }

  return {
    kind: evidenceKind,
    title: event.title,
    summary: event.summary,
    confidence: normalizeConfidence(event.confidence),
    sourceVersionHash: event.sourceVersionHash,
    refs: normalizedRefs,
  };
}

function buildEvidenceMatchKey(record: AggregatedEvidenceRecord): string {
  const refKeys = record.refs
    .map((ref) => `${ref.refType}:${ref.refId}`)
    .sort((left, right) => {
      return left.localeCompare(right, "en");
    });

  return JSON.stringify({
    kind: record.kind,
    sourceVersionHash: record.sourceVersionHash,
    title: normalizeText(record.title),
    refs: refKeys,
    summary: refKeys.length === 0 ? normalizeText(record.summary) : null,
  });
}

async function loadExistingAggregatedEvidence(
  executor: Pick<typeof db, "select">,
  params: {
    userId: string;
    sourceType: string;
    sourceId: string;
  },
): Promise<ExistingAggregatedEvidenceRecord[]> {
  const rows = await executor
    .select({
      id: knowledgeEvidence.id,
      kind: knowledgeEvidence.kind,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
      confidence: knowledgeEvidence.confidence,
      sourceVersionHash: knowledgeEvidence.sourceVersionHash,
    })
    .from(knowledgeEvidence)
    .where(
      and(
        eq(knowledgeEvidence.userId, params.userId),
        eq(knowledgeEvidence.sourceType, params.sourceType),
        eq(knowledgeEvidence.sourceId, params.sourceId),
      ),
    );

  if (rows.length === 0) {
    return [];
  }

  const refsByEvidenceId = groupEvidenceSourceLinksByEvidenceId(
    await listEvidenceSourceLinks({
      executor,
      evidenceIds: rows.map((row) => row.id),
    }),
  );

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    confidence: normalizeConfidence(row.confidence),
    sourceVersionHash: row.sourceVersionHash,
    refs: normalizeAggregatedRefs(refsByEvidenceId.get(row.id) ?? []),
  }));
}

function assignEvidenceIds(
  records: AggregatedEvidenceRecord[],
  existingRows: ExistingAggregatedEvidenceRecord[],
) {
  const availableIdsByKey = new Map<string, string[]>();
  for (const row of existingRows) {
    const key = buildEvidenceMatchKey(row);
    const ids = availableIdsByKey.get(key) ?? [];
    ids.push(row.id);
    availableIdsByKey.set(key, ids);
  }

  const desiredRecords = records.map((record) => {
    const matchKey = buildEvidenceMatchKey(record);
    const matchedId = availableIdsByKey.get(matchKey)?.shift();

    return {
      id: matchedId ?? randomUUID(),
      ...record,
    };
  });

  const matchedIds = new Set(desiredRecords.map((record) => record.id));
  const obsoleteIds = existingRows.map((row) => row.id).filter((rowId) => !matchedIds.has(rowId));

  return { desiredRecords, obsoleteIds };
}

async function applyAggregatedEvidenceSet(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  records: AggregatedEvidenceRecord[];
}): Promise<void> {
  await db.transaction(async (tx) => {
    const existingRows = await loadExistingAggregatedEvidence(tx, params);
    const { desiredRecords, obsoleteIds } = assignEvidenceIds(params.records, existingRows);
    const existingIds = existingRows.map((row) => row.id);

    if (existingIds.length > 0) {
      await tx
        .delete(knowledgeEvidenceSourceLinks)
        .where(inArray(knowledgeEvidenceSourceLinks.evidenceId, existingIds));
    }

    if (obsoleteIds.length > 0) {
      await tx.delete(knowledgeEvidence).where(inArray(knowledgeEvidence.id, obsoleteIds));
    }

    for (const record of desiredRecords) {
      await tx
        .insert(knowledgeEvidence)
        .values({
          id: record.id,
          userId: params.userId,
          kind: record.kind,
          sourceType: params.sourceType,
          sourceId: params.sourceId,
          sourceVersionHash: record.sourceVersionHash,
          title: record.title,
          summary: record.summary,
          confidence: record.confidence,
        })
        .onConflictDoUpdate({
          target: knowledgeEvidence.id,
          set: {
            kind: record.kind,
            sourceType: params.sourceType,
            sourceId: params.sourceId,
            sourceVersionHash: record.sourceVersionHash,
            title: record.title,
            summary: record.summary,
            confidence: record.confidence,
            updatedAt: new Date(),
          },
        });
    }

    const sourceLinks = desiredRecords.flatMap((record) =>
      record.refs.map((ref) => ({
        evidenceId: record.id,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        refType: ref.refType,
        refId: ref.refId,
        snippet: ref.snippet,
        weight: ref.weight,
      })),
    );

    if (sourceLinks.length > 0) {
      await tx.insert(knowledgeEvidenceSourceLinks).values(sourceLinks);
    }
  });
}

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
      kind: knowledgeEvidenceEvents.kind,
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

  if (events.length === 0) {
    await applyAggregatedEvidenceSet({
      userId,
      sourceType: "course",
      sourceId: courseId,
      records: [],
    });
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
        events.map((event) => event.id),
      ),
    );

  const refsByEventId = buildRefsByEventId(refs);
  const records = events
    .map((event) => buildCourseAggregatedEvidenceRecord(event, refsByEventId.get(event.id) ?? []))
    .filter((record): record is AggregatedEvidenceRecord => Boolean(record));

  await applyAggregatedEvidenceSet({
    userId,
    sourceType: "course",
    sourceId: courseId,
    records,
  });
}

interface AggregateSourceEventsToEvidenceOptions {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
}

export async function aggregateSourceEventsToKnowledgeEvidence({
  userId,
  sourceType,
  sourceId,
  sourceVersionHash,
}: AggregateSourceEventsToEvidenceOptions): Promise<void> {
  const normalizedSourceVersionHash = sourceVersionHash ?? null;

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
        buildSourceVersionCondition(
          knowledgeEvidenceEvents.sourceVersionHash,
          normalizedSourceVersionHash,
        ),
      ),
    );

  if (events.length === 0) {
    await applyAggregatedEvidenceSet({
      userId,
      sourceType,
      sourceId,
      records: [],
    });
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
    .innerJoin(
      knowledgeEvidenceEvents,
      eq(knowledgeEvidenceEventRefs.eventId, knowledgeEvidenceEvents.id),
    )
    .where(
      and(
        eq(knowledgeEvidenceEvents.userId, userId),
        eq(knowledgeEvidenceEvents.sourceType, sourceType),
        eq(knowledgeEvidenceEvents.sourceId, sourceId),
        buildSourceVersionCondition(
          knowledgeEvidenceEvents.sourceVersionHash,
          normalizedSourceVersionHash,
        ),
      ),
    );

  const refsByEventId = buildRefsByEventId(refs);
  const records = events.map((event) =>
    buildGenericAggregatedEvidenceRecord(event, refsByEventId.get(event.id) ?? []),
  );

  await applyAggregatedEvidenceSet({
    userId,
    sourceType,
    sourceId,
    records,
  });
}

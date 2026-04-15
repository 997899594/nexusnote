import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import {
  db,
  knowledgeEvidence,
  knowledgeInsightEvidence,
  knowledgeInsights,
  notes,
  userSkillNodeEvidence,
} from "@/db";
import {
  getCareerTreesTag,
  getNoteDetailTag,
  getNotesIndexTag,
  getProfileStatsTag,
} from "@/lib/cache/tags";
import { getLatestFocusSnapshot } from "@/lib/growth/projection-data";
import type { FocusSnapshotProjection } from "@/lib/growth/projection-types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { NOTE_BACKED_KNOWLEDGE_SOURCE_TYPES } from "@/lib/knowledge/source-types";

export type NoteWorkbenchKind = "all" | "highlight" | "note" | "capture" | "manual";

export interface NoteWorkbenchItem {
  id: string;
  title: string;
  plainText: string | null;
  updatedAt: Date | null;
  sourceType: string;
  sourceContext: typeof notes.$inferSelect.sourceContext | null;
  kind: Exclude<NoteWorkbenchKind, "all">;
  relevanceScore: number;
  isFocusRelated: boolean;
  insightKinds: KnowledgeInsight["kind"][];
}

export interface NotesWorkbenchFocus {
  directionKey: string | null;
  title: string;
  summary: string;
  progress: number;
  state: string;
  relatedItemIds: string[];
}

export interface NotesWorkbenchInsightGroup {
  insight: KnowledgeInsight;
  itemIds: string[];
}

export interface NotesWorkbenchSnapshot {
  items: NoteWorkbenchItem[];
  counts: Record<NoteWorkbenchKind, number>;
  courses: Array<{
    courseId: string;
    courseTitle: string;
    noteCount: number;
    latestUpdatedAt: Date | null;
  }>;
  insights: KnowledgeInsight[];
  focus: NotesWorkbenchFocus | null;
  insightGroups: NotesWorkbenchInsightGroup[];
}

const TOKEN_SEGMENTER = new Intl.Segmenter("zh-Hans", { granularity: "word" });

function classifyNoteKind(note: {
  sourceType: string;
  sourceContext: typeof notes.$inferSelect.sourceContext | null;
}): Exclude<NoteWorkbenchKind, "all"> {
  if (note.sourceType === "course_capture") {
    if (note.sourceContext?.chatCapture || note.sourceContext?.source === "learn_chat_capture") {
      return "capture";
    }
    if (note.sourceContext?.noteContent?.trim()) {
      return "note";
    }
    return "highlight";
  }

  return "manual";
}

function tokenize(text: string): string[] {
  return [...TOKEN_SEGMENTER.segment(text)]
    .map((segment) => segment.segment.trim().toLowerCase())
    .filter(
      (segment) => segment.length > 0 && segment !== "的" && segment !== "了" && segment !== "与",
    );
}

function buildTokenSet(parts: Array<string | null | undefined>): Set<string> {
  return new Set(
    parts.flatMap((part) => (part ? tokenize(part) : [])).filter((token) => token.length > 0),
  );
}

function computeOverlapScore(
  queryTokens: Set<string>,
  candidateParts: Array<string | null | undefined>,
) {
  if (queryTokens.size === 0) {
    return 0;
  }

  const candidateTokens = buildTokenSet(candidateParts);
  if (candidateTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / queryTokens.size;
}

function computeRecencyScore(updatedAt: Date | null): number {
  if (!updatedAt) {
    return 0;
  }

  const ageHours = (Date.now() - updatedAt.getTime()) / 3_600_000;
  if (ageHours <= 24) {
    return 12;
  }
  if (ageHours <= 72) {
    return 8;
  }
  if (ageHours <= 168) {
    return 4;
  }
  return 1;
}

function buildKnowledgeInsight(
  row: {
    id: string;
    kind: string;
    title: string;
    summary: string;
    confidence: string;
    metadata: Record<string, unknown> | null;
  },
  userId: string,
): KnowledgeInsight {
  return {
    id: row.id,
    userId,
    kind: row.kind as KnowledgeInsight["kind"],
    title: row.title,
    summary: row.summary,
    confidence: Number(row.confidence),
    metadata: row.metadata ?? {},
  };
}

async function getTopInsights(userId: string, limit = 4): Promise<KnowledgeInsight[]> {
  const rows = await db
    .select({
      id: knowledgeInsights.id,
      kind: knowledgeInsights.kind,
      title: knowledgeInsights.title,
      summary: knowledgeInsights.summary,
      confidence: knowledgeInsights.confidence,
      metadata: knowledgeInsights.metadata,
    })
    .from(knowledgeInsights)
    .where(eq(knowledgeInsights.userId, userId))
    .orderBy(desc(knowledgeInsights.confidence), desc(knowledgeInsights.updatedAt))
    .limit(limit);

  return rows.map((row) => buildKnowledgeInsight(row, userId));
}

async function getFocusRelatedNoteIds(
  userId: string,
  focusSnapshot: FocusSnapshotProjection | null,
): Promise<string[]> {
  const focusNodeId = focusSnapshot?.anchorRef ?? null;
  if (!focusNodeId) {
    return [];
  }

  const rows = await db
    .select({
      noteId: knowledgeEvidence.sourceId,
    })
    .from(userSkillNodeEvidence)
    .innerJoin(
      knowledgeEvidence,
      eq(userSkillNodeEvidence.knowledgeEvidenceId, knowledgeEvidence.id),
    )
    .where(
      and(
        eq(userSkillNodeEvidence.userId, userId),
        eq(userSkillNodeEvidence.nodeId, focusNodeId),
        inArray(knowledgeEvidence.sourceType, [...NOTE_BACKED_KNOWLEDGE_SOURCE_TYPES]),
      ),
    );

  return [
    ...new Set(rows.map((row) => row.noteId).filter((value): value is string => Boolean(value))),
  ];
}

async function getInsightNoteIdMap(insightIds: string[]): Promise<Map<string, string[]>> {
  if (insightIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      insightId: knowledgeInsightEvidence.insightId,
      noteId: knowledgeEvidence.sourceId,
    })
    .from(knowledgeInsightEvidence)
    .innerJoin(knowledgeEvidence, eq(knowledgeInsightEvidence.evidenceId, knowledgeEvidence.id))
    .where(
      and(
        inArray(knowledgeInsightEvidence.insightId, insightIds),
        inArray(knowledgeEvidence.sourceType, [...NOTE_BACKED_KNOWLEDGE_SOURCE_TYPES]),
      ),
    );

  const noteIdsByInsightId = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.noteId) {
      continue;
    }

    const existing = noteIdsByInsightId.get(row.insightId) ?? [];
    if (!existing.includes(row.noteId)) {
      existing.push(row.noteId);
    }
    noteIdsByInsightId.set(row.insightId, existing);
  }

  return noteIdsByInsightId;
}

function buildFocusProjection(
  focusSnapshot: FocusSnapshotProjection | null,
  relatedItemIds: string[],
): NotesWorkbenchFocus | null {
  if (!focusSnapshot) {
    return null;
  }

  return {
    directionKey: focusSnapshot.directionKey,
    title: focusSnapshot.title,
    summary: focusSnapshot.summary,
    progress: focusSnapshot.progress,
    state: focusSnapshot.state,
    relatedItemIds,
  };
}

export async function getRecentNotesCached(userId: string, limit = 24) {
  "use cache";

  cacheLife("minutes");
  cacheTag(getNotesIndexTag(userId));

  return db.query.notes.findMany({
    where: eq(notes.userId, userId),
    orderBy: desc(notes.updatedAt),
    limit,
  });
}

export async function getNotesWorkbenchCached(userId: string): Promise<NotesWorkbenchSnapshot> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getNotesIndexTag(userId));
  cacheTag(getCareerTreesTag(userId));
  cacheTag(getProfileStatsTag(userId));

  const [rows, focusSnapshot, insights] = await Promise.all([
    db.query.notes.findMany({
      where: eq(notes.userId, userId),
      orderBy: desc(notes.updatedAt),
      limit: 200,
    }),
    getLatestFocusSnapshot(userId),
    getTopInsights(userId, 4),
  ]);

  const [focusRelatedNoteIds, insightNoteIdMap] = await Promise.all([
    getFocusRelatedNoteIds(userId, focusSnapshot),
    getInsightNoteIdMap(insights.map((insight) => insight.id)),
  ]);

  const focusRelatedNoteIdSet = new Set(focusRelatedNoteIds);
  const focusTokens = buildTokenSet([
    focusSnapshot?.title,
    focusSnapshot?.summary,
    focusSnapshot?.node?.title,
    focusSnapshot?.node?.summary,
  ]);

  const insightTokens = buildTokenSet(
    insights.flatMap((insight) => [insight.title, insight.summary]),
  );

  const itemInsightKinds = new Map<string, Set<KnowledgeInsight["kind"]>>();
  for (const insight of insights) {
    const noteIds = insightNoteIdMap.get(insight.id) ?? [];
    for (const noteId of noteIds) {
      const kinds = itemInsightKinds.get(noteId) ?? new Set<KnowledgeInsight["kind"]>();
      kinds.add(insight.kind);
      itemInsightKinds.set(noteId, kinds);
    }
  }

  const items: NoteWorkbenchItem[] = rows
    .map((note) => {
      const kind = classifyNoteKind(note);
      const noteInsightKinds = [
        ...(itemInsightKinds.get(note.id) ?? new Set<KnowledgeInsight["kind"]>()),
      ];
      const isFocusRelated = focusRelatedNoteIdSet.has(note.id);
      const focusLexicalScore = computeOverlapScore(focusTokens, [
        note.title,
        note.plainText,
        note.sourceContext?.courseTitle,
        note.sourceContext?.sectionTitle,
        note.sourceContext?.selectionText,
        note.sourceContext?.latestExcerpt,
      ]);
      const insightLexicalScore = computeOverlapScore(insightTokens, [
        note.title,
        note.plainText,
        note.sourceContext?.courseTitle,
        note.sourceContext?.sectionTitle,
        note.sourceContext?.selectionText,
        note.sourceContext?.latestExcerpt,
      ]);

      const kindWeight =
        kind === "capture" ? 8 : kind === "note" ? 6 : kind === "highlight" ? 4 : 2;
      const relevanceScore =
        (isFocusRelated ? 100 : 0) +
        noteInsightKinds.length * 28 +
        focusLexicalScore * 40 +
        insightLexicalScore * 18 +
        kindWeight +
        computeRecencyScore(note.updatedAt ?? null);

      return {
        id: note.id,
        title: note.title,
        plainText: note.plainText,
        updatedAt: note.updatedAt,
        sourceType: note.sourceType,
        sourceContext: note.sourceContext ?? null,
        kind,
        relevanceScore,
        isFocusRelated,
        insightKinds: noteInsightKinds,
      };
    })
    .sort((left, right) => {
      if (right.relevanceScore !== left.relevanceScore) {
        return right.relevanceScore - left.relevanceScore;
      }

      const leftTime = left.updatedAt?.getTime() ?? 0;
      const rightTime = right.updatedAt?.getTime() ?? 0;
      return rightTime - leftTime;
    });

  const counts: Record<NoteWorkbenchKind, number> = {
    all: items.length,
    highlight: 0,
    note: 0,
    capture: 0,
    manual: 0,
  };

  for (const item of items) {
    counts[item.kind] += 1;
  }

  const courseMap = new Map<
    string,
    {
      courseId: string;
      courseTitle: string;
      noteCount: number;
      latestUpdatedAt: Date | null;
    }
  >();

  for (const item of items) {
    const courseId = item.sourceContext?.courseId;
    const courseTitle = item.sourceContext?.courseTitle?.trim();

    if (!courseId || !courseTitle) {
      continue;
    }

    const existing = courseMap.get(courseId);
    if (!existing) {
      courseMap.set(courseId, {
        courseId,
        courseTitle,
        noteCount: 1,
        latestUpdatedAt: item.updatedAt,
      });
      continue;
    }

    existing.noteCount += 1;
    if (
      item.updatedAt &&
      (!existing.latestUpdatedAt || item.updatedAt.getTime() > existing.latestUpdatedAt.getTime())
    ) {
      existing.latestUpdatedAt = item.updatedAt;
    }
  }

  const courses = Array.from(courseMap.values()).sort((a, b) => {
    const left = a.latestUpdatedAt?.getTime() ?? 0;
    const right = b.latestUpdatedAt?.getTime() ?? 0;
    return right - left;
  });

  const focusRelatedItems = items
    .filter((item) => item.isFocusRelated)
    .slice(0, 6)
    .map((item) => item.id);

  const insightGroups: NotesWorkbenchInsightGroup[] = insights
    .map((insight) => ({
      insight,
      itemIds: (insightNoteIdMap.get(insight.id) ?? []).filter((noteId) =>
        items.some((item) => item.id === noteId),
      ),
    }))
    .filter((group) => group.itemIds.length > 0)
    .slice(0, 3);

  return {
    items,
    counts,
    courses,
    insights,
    focus: buildFocusProjection(focusSnapshot, focusRelatedItems),
    insightGroups,
  };
}

export async function getNoteDetailCached(userId: string, noteId: string) {
  "use cache";

  cacheLife("minutes");
  cacheTag(getNotesIndexTag(userId));
  cacheTag(getNoteDetailTag(userId, noteId));

  return db.query.notes.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, noteId), eq(table.userId, userId)),
  });
}

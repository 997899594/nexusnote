import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import {
  db,
  knowledgeEvidence,
  knowledgeInsightEvidence,
  knowledgeInsights,
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
import {
  buildNotesWorkbenchProjection,
  type NotesWorkbenchSnapshot,
} from "@/lib/knowledge/workbench-projection";
import { getOwnedNote, listOwnedRecentNotes } from "@/lib/notes/repository";

function pushUniqueMapValue(map: Map<string, string[]>, key: string, value: string): void {
  const existingValues = map.get(key) ?? [];
  if (!existingValues.includes(value)) {
    existingValues.push(value);
    map.set(key, existingValues);
  }
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
    if (row.noteId) {
      pushUniqueMapValue(noteIdsByInsightId, row.insightId, row.noteId);
    }
  }

  return noteIdsByInsightId;
}

export async function getNotesWorkbenchCached(userId: string): Promise<NotesWorkbenchSnapshot> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getNotesIndexTag(userId));
  cacheTag(getCareerTreesTag(userId));
  cacheTag(getProfileStatsTag(userId));

  const [rows, focusSnapshot, insights] = await Promise.all([
    listOwnedRecentNotes(userId, 200),
    getLatestFocusSnapshot(userId),
    getTopInsights(userId, 4),
  ]);

  const [focusRelatedNoteIds, insightNoteIdMap] = await Promise.all([
    getFocusRelatedNoteIds(userId, focusSnapshot),
    getInsightNoteIdMap(insights.map((insight) => insight.id)),
  ]);

  return buildNotesWorkbenchProjection({
    notes: rows,
    focusSnapshot,
    insights,
    focusRelatedNoteIds,
    insightNoteIdMap,
  });
}

export async function getNoteDetailCached(userId: string, noteId: string) {
  "use cache";

  cacheLife("minutes");
  cacheTag(getNotesIndexTag(userId));
  cacheTag(getNoteDetailTag(userId, noteId));

  return getOwnedNote(noteId, userId);
}

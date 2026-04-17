import type { notes } from "@/db";
import type { FocusSnapshotProjection } from "@/lib/growth/projection-types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";

export type NoteWorkbenchKind = "all" | "highlight" | "note" | "capture" | "manual";
type NoteRecord = typeof notes.$inferSelect;

export interface NoteWorkbenchItem {
  id: string;
  title: string;
  plainText: string | null;
  updatedAt: Date | null;
  sourceType: string;
  sourceContext: NoteRecord["sourceContext"] | null;
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
  sourceContext: NoteRecord["sourceContext"] | null;
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

function getNoteWorkbenchCandidateParts(
  note: Pick<NoteRecord, "title" | "plainText" | "sourceContext">,
): Array<string | null | undefined> {
  return [
    note.title,
    note.plainText,
    note.sourceContext?.courseTitle,
    note.sourceContext?.sectionTitle,
    note.sourceContext?.selectionText,
    note.sourceContext?.latestExcerpt,
  ];
}

function getNoteKindWeight(kind: NoteWorkbenchItem["kind"]): number {
  switch (kind) {
    case "capture":
      return 8;
    case "note":
      return 6;
    case "highlight":
      return 4;
    case "manual":
      return 2;
  }
}

export function compareUpdatedAtDesc(left: Date | null, right: Date | null): number {
  const leftTime = left?.getTime() ?? 0;
  const rightTime = right?.getTime() ?? 0;
  return rightTime - leftTime;
}

function buildItemInsightKinds(
  insights: KnowledgeInsight[],
  insightNoteIdMap: Map<string, string[]>,
): Map<string, Set<KnowledgeInsight["kind"]>> {
  const itemInsightKinds = new Map<string, Set<KnowledgeInsight["kind"]>>();

  for (const insight of insights) {
    const noteIds = insightNoteIdMap.get(insight.id) ?? [];
    for (const noteId of noteIds) {
      const kinds = itemInsightKinds.get(noteId) ?? new Set<KnowledgeInsight["kind"]>();
      kinds.add(insight.kind);
      itemInsightKinds.set(noteId, kinds);
    }
  }

  return itemInsightKinds;
}

function buildWorkbenchCounts(items: NoteWorkbenchItem[]): Record<NoteWorkbenchKind, number> {
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

  return counts;
}

function buildNoteCourseSummaries(items: NoteWorkbenchItem[]): NotesWorkbenchSnapshot["courses"] {
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

  return Array.from(courseMap.values()).sort((a, b) =>
    compareUpdatedAtDesc(a.latestUpdatedAt, b.latestUpdatedAt),
  );
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

export function buildNotesWorkbenchProjection(input: {
  notes: NoteRecord[];
  focusSnapshot: FocusSnapshotProjection | null;
  insights: KnowledgeInsight[];
  focusRelatedNoteIds: string[];
  insightNoteIdMap: Map<string, string[]>;
}): NotesWorkbenchSnapshot {
  const focusRelatedNoteIdSet = new Set(input.focusRelatedNoteIds);
  const focusTokens = buildTokenSet([
    input.focusSnapshot?.title,
    input.focusSnapshot?.summary,
    input.focusSnapshot?.node?.title,
    input.focusSnapshot?.node?.summary,
  ]);

  const insightTokens = buildTokenSet(
    input.insights.flatMap((insight) => [insight.title, insight.summary]),
  );

  const itemInsightKinds = buildItemInsightKinds(input.insights, input.insightNoteIdMap);

  const items: NoteWorkbenchItem[] = input.notes
    .map((note) => {
      const kind = classifyNoteKind(note);
      const candidateParts = getNoteWorkbenchCandidateParts(note);
      const noteInsightKinds = [
        ...(itemInsightKinds.get(note.id) ?? new Set<KnowledgeInsight["kind"]>()),
      ];
      const isFocusRelated = focusRelatedNoteIdSet.has(note.id);
      const focusLexicalScore = computeOverlapScore(focusTokens, candidateParts);
      const insightLexicalScore = computeOverlapScore(insightTokens, candidateParts);
      const relevanceScore =
        (isFocusRelated ? 100 : 0) +
        noteInsightKinds.length * 28 +
        focusLexicalScore * 40 +
        insightLexicalScore * 18 +
        getNoteKindWeight(kind) +
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

      return compareUpdatedAtDesc(left.updatedAt, right.updatedAt);
    });

  const counts = buildWorkbenchCounts(items);
  const courses = buildNoteCourseSummaries(items);
  const focusRelatedItems = items
    .filter((item) => item.isFocusRelated)
    .slice(0, 6)
    .map((item) => item.id);

  const visibleItemIds = new Set(items.map((item) => item.id));
  const insightGroups: NotesWorkbenchInsightGroup[] = input.insights
    .map((insight) => ({
      insight,
      itemIds: (input.insightNoteIdMap.get(insight.id) ?? []).filter((noteId) =>
        visibleItemIds.has(noteId),
      ),
    }))
    .filter((group) => group.itemIds.length > 0)
    .slice(0, 3);

  return {
    items,
    counts,
    courses,
    insights: input.insights,
    focus: buildFocusProjection(input.focusSnapshot, focusRelatedItems),
    insightGroups,
  };
}

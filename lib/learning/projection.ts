import type { Annotation } from "@/hooks/useAnnotations";
import type { UserGrowthContext } from "@/lib/growth/generation-context";
import {
  type GrowthFocusSummary,
  type GrowthInsightSummary,
  normalizeProjectionState,
} from "@/lib/growth/projection-types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { buildLearningGuidance, type LearningGuidance } from "@/lib/learning/guidance";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import type { getOwnedCourseWithOutline } from "./course-repository";

type OwnedCourseWithOutline = NonNullable<Awaited<ReturnType<typeof getOwnedCourseWithOutline>>>;

export interface LearnSectionProjection {
  title: string;
  description: string;
  nodeId: string;
}

export interface LearnChapterProjection {
  title: string;
  description: string;
  sections: LearnSectionProjection[];
}

export interface LearnSectionDocProjection {
  id: string;
  title: string | null;
  content: string | null;
  outlineNodeKey: string | null;
  annotations: Annotation[];
}

export interface LearnProgressProjection {
  currentChapter: number;
  completedSections: string[];
  completedAt: Date | null;
}

export interface LearnPageProjection {
  courseTitle: string;
  chapters: LearnChapterProjection[];
  sectionDocs: LearnSectionDocProjection[];
  progressRecord: LearnProgressProjection | null;
  growthFocus: GrowthFocusSummary | null;
  insights: GrowthInsightSummary[];
}

export interface LearnResumeState {
  initialChapterIndex: number;
  initialCompletedSections: string[];
  scrollToSectionId: string | null;
}

export interface LearnProjectionSectionDocRow {
  id: string;
  title: string | null;
  content: string | null;
  outlineNodeKey: string | null;
}

export interface LearnProjectionAnnotationRow {
  id: string;
  courseSectionId: string;
  type: string;
  anchor: unknown;
  color: string | null;
  noteContent: string | null;
  createdAt: Date | null;
}

function buildLearnChapters(courseSession: OwnedCourseWithOutline): LearnChapterProjection[] {
  return courseSession.outline.chapters.map((chapter, chapterIndex) => ({
    title: chapter.title,
    description: chapter.description ?? "",
    sections: chapter.sections.map((section, sectionIndex) => ({
      title: section.title,
      description: section.description ?? "",
      nodeId: buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
    })),
  }));
}

function buildAnnotationsBySectionId(
  rows: LearnProjectionAnnotationRow[],
): Map<string, Annotation[]> {
  const annotationsBySectionId = new Map<string, Annotation[]>();

  for (const row of rows) {
    const existing = annotationsBySectionId.get(row.courseSectionId) ?? [];
    existing.push({
      id: row.id,
      type: row.type as "highlight" | "note",
      anchor: row.anchor as {
        textContent: string;
        startOffset: number;
        endOffset: number;
      },
      color: row.color ?? undefined,
      noteContent: row.noteContent ?? undefined,
      createdAt: row.createdAt?.toISOString() ?? "",
    });
    annotationsBySectionId.set(row.courseSectionId, existing);
  }

  return annotationsBySectionId;
}

function buildSectionDocs(
  rows: LearnProjectionSectionDocRow[],
  annotationsBySectionId: Map<string, Annotation[]>,
): LearnSectionDocProjection[] {
  return rows.map((doc) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    outlineNodeKey: doc.outlineNodeKey,
    annotations: annotationsBySectionId.get(doc.id) ?? [],
  }));
}

function buildGrowthFocusSummary(guidance: LearningGuidance | null): GrowthFocusSummary | null {
  const focus = guidance?.growth.currentFocus;

  if (!focus?.title) {
    return null;
  }

  return {
    directionKey: guidance?.growth.currentDirection?.directionKey ?? null,
    title: focus.title,
    summary: focus.summary ?? "",
    progress: focus.progress ?? 0,
    state: normalizeProjectionState(focus.state ?? "ready"),
  };
}

function buildGrowthInsightSummaries(guidance: LearningGuidance | null): GrowthInsightSummary[] {
  return (guidance?.growth.insights ?? []).slice(0, 3).map((insight) => ({
    id: `${insight.kind}:${insight.title}`,
    kind: insight.kind as KnowledgeInsight["kind"],
    title: insight.title,
    summary: insight.summary,
    confidence: insight.confidence,
  }));
}

export function buildLearnPageProjection(input: {
  courseSession: OwnedCourseWithOutline;
  progressRecord: LearnProgressProjection | null;
  growthContext: UserGrowthContext;
  sectionDocRows: LearnProjectionSectionDocRow[];
  annotationRows: LearnProjectionAnnotationRow[];
}): LearnPageProjection {
  const chapters = buildLearnChapters(input.courseSession);
  const annotationsBySectionId = buildAnnotationsBySectionId(input.annotationRows);
  const sectionDocs = buildSectionDocs(input.sectionDocRows, annotationsBySectionId);
  const currentChapterIndex = input.progressRecord?.currentChapter ?? 0;
  const guidance =
    currentChapterIndex < input.courseSession.outline.chapters.length
      ? buildLearningGuidance({
          course: input.courseSession,
          chapterIndex: currentChapterIndex,
          growth: input.growthContext,
        })
      : null;

  return {
    courseTitle: input.courseSession.title ?? "Untitled Course",
    chapters,
    sectionDocs,
    progressRecord: input.progressRecord,
    growthFocus: buildGrowthFocusSummary(guidance),
    insights: buildGrowthInsightSummaries(guidance),
  };
}

export function resolveLearnResumeState(
  snapshot: Pick<LearnPageProjection, "chapters" | "progressRecord">,
  requestedChapter: string | null | undefined,
): LearnResumeState {
  const initialCompletedSections = snapshot.progressRecord?.completedSections ?? [];
  const completedSet = new Set(initialCompletedSections);
  const maxChapterIndex = Math.max(snapshot.chapters.length - 1, 0);

  let initialChapterIndex: number;
  if (requestedChapter) {
    const chapterNum = Number.parseInt(requestedChapter, 10);
    initialChapterIndex = Number.isNaN(chapterNum)
      ? 0
      : Math.min(Math.max(0, chapterNum - 1), maxChapterIndex);
  } else {
    const resumeChapter = snapshot.chapters.findIndex((chapter) =>
      chapter.sections.some((section) => !completedSet.has(section.nodeId)),
    );
    initialChapterIndex =
      resumeChapter >= 0 ? resumeChapter : (snapshot.progressRecord?.currentChapter ?? 0);
  }

  initialChapterIndex = Math.min(Math.max(initialChapterIndex, 0), maxChapterIndex);

  const resumeChapter = snapshot.chapters[initialChapterIndex];
  const firstUnreadSection = resumeChapter?.sections.find(
    (section) => !completedSet.has(section.nodeId),
  );

  return {
    initialChapterIndex,
    initialCompletedSections,
    scrollToSectionId: firstUnreadSection?.nodeId ?? null,
  };
}

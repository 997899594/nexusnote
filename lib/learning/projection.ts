import type { Annotation } from "@/lib/learning/learn-annotations-client";
import { projectLearningMomentum } from "@/lib/learning/momentum";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import type { getOwnedCourseWithOutline } from "./course-repository";

type OwnedCourseWithOutline = NonNullable<Awaited<ReturnType<typeof getOwnedCourseWithOutline>>>;

export interface LearnSectionProjection {
  title: string;
  description: string;
  nodeId: string;
  nodeKey: string;
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

export interface LearnPublicAnnotationProjection {
  id: string;
  sectionKey: string;
  quotedText: string;
  body: string;
  status: "visible" | "hidden";
  createdAt: string;
  author: {
    name: string | null;
    image: string | null;
  };
  publicationSlug: string;
}

export interface LearnProgressProjection {
  completedSections: string[];
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface LearnPageProjection {
  courseTitle: string;
  courseDescription: string | null;
  difficulty: string | null;
  estimatedMinutes: number | null;
  learningOutcome: string | null;
  targetAudience: string | null;
  chapters: LearnChapterProjection[];
  sectionDocs: LearnSectionDocProjection[];
  publicAnnotations: LearnPublicAnnotationProjection[];
  progressRecord: LearnProgressProjection | null;
}

export interface LearnResumeState {
  initialChapterIndex: number;
  initialCompletedSections: string[];
  scrollToSectionId: string | null;
  isCourseComplete: boolean;
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

export interface LearnProjectionPublicAnnotationRow {
  id: string;
  sectionKey: string;
  quotedText: string;
  body: string;
  status: "visible" | "hidden";
  createdAt: Date | null;
  authorName: string | null;
  authorImage: string | null;
  publicationSlug: string;
}

function buildLearnChapters(courseSession: OwnedCourseWithOutline): LearnChapterProjection[] {
  return courseSession.outline.chapters.map((chapter, chapterIndex) => ({
    title: chapter.title,
    description: chapter.description ?? "",
    sections: chapter.sections.map((section, sectionIndex) => ({
      title: section.title,
      description: section.description ?? "",
      nodeId: section.nodeId ?? buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
      nodeKey: buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
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

function buildPublicAnnotations(
  rows: LearnProjectionPublicAnnotationRow[],
): LearnPublicAnnotationProjection[] {
  return rows.map((row) => ({
    id: row.id,
    sectionKey: row.sectionKey,
    quotedText: row.quotedText,
    body: row.body,
    status: row.status,
    createdAt: row.createdAt?.toISOString() ?? "",
    author: {
      name: row.authorName,
      image: row.authorImage,
    },
    publicationSlug: row.publicationSlug,
  }));
}

export function buildLearnPageProjection(input: {
  courseSession: OwnedCourseWithOutline;
  progressRecord: LearnProgressProjection | null;
  sectionDocRows: LearnProjectionSectionDocRow[];
  annotationRows: LearnProjectionAnnotationRow[];
  publicAnnotationRows: LearnProjectionPublicAnnotationRow[];
}): LearnPageProjection {
  const chapters = buildLearnChapters(input.courseSession);
  const annotationsBySectionId = buildAnnotationsBySectionId(input.annotationRows);
  const sectionDocs = buildSectionDocs(input.sectionDocRows, annotationsBySectionId);
  const publicAnnotations = buildPublicAnnotations(input.publicAnnotationRows);

  return {
    courseTitle: input.courseSession.title ?? "Untitled Course",
    courseDescription:
      input.courseSession.description ?? input.courseSession.outline.description ?? null,
    difficulty: input.courseSession.difficulty ?? input.courseSession.outline.difficulty ?? null,
    estimatedMinutes: input.courseSession.estimatedMinutes ?? null,
    learningOutcome: input.courseSession.outline.learningOutcome ?? null,
    targetAudience: input.courseSession.outline.targetAudience ?? null,
    chapters,
    sectionDocs,
    publicAnnotations,
    progressRecord: input.progressRecord,
  };
}

export function resolveLearnResumeState(
  snapshot: Pick<LearnPageProjection, "chapters" | "progressRecord">,
  requestedChapter: string | null | undefined,
): LearnResumeState {
  const initialCompletedSections = snapshot.progressRecord?.completedSections ?? [];
  const completedSet = new Set(initialCompletedSections);
  const momentum = projectLearningMomentum({
    sections: snapshot.chapters.flatMap((chapter, chapterIndex) =>
      chapter.sections.map((section, sectionIndex) => ({
        nodeId: section.nodeId,
        title: section.title,
        chapterIndex,
        sectionIndex,
      })),
    ),
    completedSections: initialCompletedSections,
    startedAt: snapshot.progressRecord?.startedAt,
    completedAt: snapshot.progressRecord?.completedAt,
  });
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
    initialChapterIndex = resumeChapter >= 0 ? resumeChapter : 0;
  }

  initialChapterIndex = Math.min(Math.max(initialChapterIndex, 0), maxChapterIndex);

  const resumeChapter = snapshot.chapters[initialChapterIndex];
  const firstUnreadSection = resumeChapter?.sections.find(
    (section) => !completedSet.has(section.nodeId),
  );
  const finalSection = snapshot.chapters.at(-1)?.sections.at(-1) ?? null;

  return {
    initialChapterIndex,
    initialCompletedSections,
    scrollToSectionId:
      momentum.status === "completed"
        ? (finalSection?.nodeId ?? null)
        : (firstUnreadSection?.nodeId ?? null),
    isCourseComplete: momentum.status === "completed",
  };
}

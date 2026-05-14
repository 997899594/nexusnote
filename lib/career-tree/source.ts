import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { courseOutlineNodes, courseOutlineVersions, courseProgress, courses, db } from "@/db";
import {
  buildChapterOutlineNodeKey,
  buildSectionOutlineNodeKey,
} from "@/lib/learning/outline-node-key";
import { normalizeStringList, stableStringify } from "@/lib/utils/stable-data";

const careerOutlineSectionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

const careerOutlineChapterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
  sections: z.array(careerOutlineSectionSchema).optional(),
});

const careerOutlineDataSchema = z.object({
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  courseSkillIds: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  chapters: z.array(careerOutlineChapterSchema).optional(),
});

export interface NormalizedCareerOutlineSection {
  sectionKey: string;
  title: string;
  description: string;
}

export interface NormalizedCareerOutlineChapter {
  chapterKey: string;
  chapterIndex: number;
  title: string;
  description: string;
  explicitSkillIds: string[];
  sections: NormalizedCareerOutlineSection[];
}

export interface NormalizedCareerOutline {
  title: string;
  description: string | null;
  courseSkillIds: string[];
  prerequisites: string[];
  chapters: NormalizedCareerOutlineChapter[];
}

export interface CareerCourseSource {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  outlineVersionId: string;
  outlineVersionHash: string;
  outline: NormalizedCareerOutline;
}

export interface CareerCourseProgress {
  completedChapters: number[];
  completedSections: string[];
}

type CourseSourceExecutor = Pick<typeof db, "select" | "query">;

export function normalizeCareerOutline(input: unknown): NormalizedCareerOutline {
  const parsed = careerOutlineDataSchema.parse(input ?? {});

  return {
    title: parsed.title?.trim() || "未命名课程",
    description: parsed.description?.trim() || null,
    courseSkillIds: normalizeStringList(parsed.courseSkillIds),
    prerequisites: normalizeStringList(parsed.prerequisites),
    chapters: (parsed.chapters ?? []).map((chapter, chapterIndex) => ({
      chapterKey: buildChapterOutlineNodeKey(chapterIndex),
      chapterIndex,
      title: chapter.title?.trim() || `第 ${chapterIndex + 1} 章`,
      description: chapter.description?.trim() || "",
      explicitSkillIds: normalizeStringList(chapter.skillIds),
      sections: (chapter.sections ?? []).map((section, sectionIndex) => ({
        sectionKey: buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
        title: section.title?.trim() || `第 ${chapterIndex + 1}.${sectionIndex + 1} 节`,
        description: section.description?.trim() || "",
      })),
    })),
  };
}

export function computeCareerOutlineHash(outline: NormalizedCareerOutline): string {
  return createHash("sha256").update(stableStringify(outline)).digest("hex");
}

export async function getCareerCourseSource(
  userId: string,
  courseId: string,
  executor: CourseSourceExecutor = db,
): Promise<CareerCourseSource | null> {
  const [course] = await executor
    .select()
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.userId, userId)))
    .limit(1);

  if (!course) {
    return null;
  }

  const outlineVersion = await executor.query.courseOutlineVersions.findFirst({
    where: and(
      eq(courseOutlineVersions.courseId, course.id),
      eq(courseOutlineVersions.isLatest, true),
    ),
    orderBy: desc(courseOutlineVersions.createdAt),
  });

  if (!outlineVersion) {
    return null;
  }

  const nodes = await executor
    .select()
    .from(courseOutlineNodes)
    .where(eq(courseOutlineNodes.outlineVersionId, outlineVersion.id));

  const chapterNodes = nodes
    .filter((node) => node.nodeType === "chapter")
    .sort(
      (left, right) => left.chapterIndex - right.chapterIndex || left.position - right.position,
    );

  const outline = normalizeCareerOutline({
    title: outlineVersion.title,
    description: outlineVersion.description,
    courseSkillIds: outlineVersion.courseSkillIds,
    prerequisites: outlineVersion.prerequisites,
    chapters: chapterNodes.map((chapterNode) => ({
      title: chapterNode.title,
      description: chapterNode.description ?? "",
      skillIds: chapterNode.skillIds ?? [],
      sections: nodes
        .filter((node) => node.nodeType === "section" && node.parentNodeKey === chapterNode.nodeKey)
        .sort(
          (left, right) => left.chapterIndex - right.chapterIndex || left.position - right.position,
        )
        .map((sectionNode) => ({
          title: sectionNode.title,
          description: sectionNode.description ?? "",
        })),
    })),
  });

  return {
    id: course.id,
    userId: course.userId,
    title: course.title,
    description: course.description,
    outlineVersionId: outlineVersion.id,
    outlineVersionHash: outlineVersion.versionHash,
    outline,
  };
}

export async function hasEligibleCareerCourses(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: courses.id })
    .from(courses)
    .innerJoin(
      courseOutlineVersions,
      and(eq(courseOutlineVersions.courseId, courses.id), eq(courseOutlineVersions.isLatest, true)),
    )
    .where(eq(courses.userId, userId))
    .limit(1);

  return rows.length > 0;
}

export async function listCareerCourseSourcesForUser(params: {
  userId?: string;
  courseId?: string;
  limit?: number;
}): Promise<Array<{ userId: string; courseId: string }>> {
  const rows = await db
    .select({
      userId: courses.userId,
      courseId: courses.id,
    })
    .from(courses)
    .innerJoin(
      courseOutlineVersions,
      and(eq(courseOutlineVersions.courseId, courses.id), eq(courseOutlineVersions.isLatest, true)),
    )
    .where(
      and(
        params.userId ? eq(courses.userId, params.userId) : undefined,
        params.courseId ? eq(courses.id, params.courseId) : undefined,
      ),
    )
    .orderBy(desc(courses.updatedAt))
    .limit(params.limit ?? 500);

  return rows;
}

export async function getCareerCourseProgressMap(
  userId: string,
  courseIds: string[],
): Promise<Map<string, CareerCourseProgress>> {
  if (courseIds.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({
      courseId: courseProgress.courseId,
      completedChapters: courseProgress.completedChapters,
      completedSections: courseProgress.completedSections,
    })
    .from(courseProgress)
    .where(and(eq(courseProgress.userId, userId)));

  return new Map(
    rows
      .filter((row) => courseIds.includes(row.courseId))
      .map((row) => [
        row.courseId,
        {
          completedChapters: row.completedChapters ?? [],
          completedSections: row.completedSections ?? [],
        },
      ]),
  );
}

export function computeCourseProgressHash(progress: Map<string, CareerCourseProgress>): string {
  return createHash("sha256")
    .update(
      stableStringify([...progress.entries()].sort(([left], [right]) => left.localeCompare(right))),
    )
    .digest("hex");
}

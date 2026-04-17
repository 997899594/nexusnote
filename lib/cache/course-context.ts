/**
 * Course Context Cache
 *
 * Redis-backed cache for course outline and chapter content.
 * Replaces N+1 queries with batch SQL + 5-minute TTL cache.
 * Graceful fallback: if Redis is unavailable, queries DB directly.
 */

import { and, courseSections, db, eq, inArray } from "@/db";
import { getCourseWithOutline } from "@/lib/learning/course-repository";
import { buildSectionOutlineNodeKey } from "@/lib/learning/outline-node-key";
import { getRedis } from "@/lib/redis";

const CACHE_TTL = 300; // 5 minutes

interface OutlineSection {
  title: string;
  description?: string;
}

interface OutlineChapter {
  title: string;
  description?: string;
  skillIds?: string[];
  sections: OutlineSection[];
}

export interface CourseOutline {
  courseTitle: string;
  courseSkillIds: string[];
  chapters: OutlineChapter[];
}

interface SectionContent {
  title: string;
  text: string;
}

export interface ChapterContent {
  chapterTitle: string;
  chapterDescription: string;
  chapterSkillIds: string[];
  courseSkillIds: string[];
  sections: SectionContent[];
}

type CourseWithOutline = NonNullable<Awaited<ReturnType<typeof getCourseWithOutline>>>;

function getOutlineCacheKey(courseId: string): string {
  return `course:outline:${courseId}`;
}

function getChapterCacheKey(courseId: string, chapterIndex: number): string {
  return `course:chapter:${courseId}:${chapterIndex}`;
}

async function readJsonCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const cached = await getRedis().get(cacheKey);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
}

async function writeJsonCache(cacheKey: string, value: unknown): Promise<void> {
  try {
    await getRedis().set(cacheKey, JSON.stringify(value), "EX", CACHE_TTL);
  } catch {
    // Redis unavailable, skip caching
  }
}

async function deleteCacheKey(cacheKey: string): Promise<void> {
  try {
    await getRedis().del(cacheKey);
  } catch {
    // Redis unavailable, skip invalidation
  }
}

function buildCourseOutline(course: CourseWithOutline): CourseOutline {
  return {
    courseTitle: course.title ?? "未知课程",
    courseSkillIds: course.outline.courseSkillIds ?? [],
    chapters: course.outline.chapters.map((chapter) => ({
      title: chapter.title,
      description: chapter.description ?? "",
      skillIds: chapter.skillIds ?? [],
      sections: chapter.sections.map((section) => ({
        title: section.title,
        description: section.description ?? "",
      })),
    })),
  };
}

function buildEmptyChapterContent(
  chapter: OutlineChapter,
  courseSkillIds: string[],
): ChapterContent {
  return {
    chapterTitle: chapter.title,
    chapterDescription: chapter.description ?? "",
    chapterSkillIds: chapter.skillIds ?? [],
    courseSkillIds,
    sections: [],
  };
}

function buildSectionNodeIds(chapterIndex: number, sectionCount: number): string[] {
  return Array.from({ length: sectionCount }, (_, sectionIndex) =>
    buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
  );
}

function buildSectionDocMap(
  docs: Array<{
    title: string;
    content: string | null;
    outlineNodeKey: string | null;
  }>,
): Map<string, SectionContent> {
  const docMap = new Map<string, SectionContent>();

  for (const doc of docs) {
    if (!doc.content || !doc.outlineNodeKey) {
      continue;
    }

    docMap.set(doc.outlineNodeKey, {
      title: doc.title,
      text: doc.content,
    });
  }

  return docMap;
}

function mapSectionsFromNodeIds(
  nodeIds: string[],
  docMap: Map<string, SectionContent>,
): SectionContent[] {
  return nodeIds.flatMap((nodeId) => {
    const doc = docMap.get(nodeId);
    return doc ? [doc] : [];
  });
}

export async function getCourseOutline(courseId: string): Promise<CourseOutline | null> {
  const cached = await readJsonCache<CourseOutline>(getOutlineCacheKey(courseId));
  if (cached) {
    return cached;
  }

  const course = await getCourseWithOutline(courseId);
  if (!course) {
    return null;
  }

  const result = buildCourseOutline(course);

  await writeJsonCache(getOutlineCacheKey(courseId), result);
  return result;
}

export async function getChapterContent(
  courseId: string,
  chapterIndex: number,
): Promise<ChapterContent | null> {
  const cached = await readJsonCache<ChapterContent>(getChapterCacheKey(courseId, chapterIndex));
  if (cached) {
    return cached;
  }

  const outline = await getCourseOutline(courseId);
  if (!outline) {
    return null;
  }

  const chapter = outline.chapters[chapterIndex];
  if (!chapter) {
    return null;
  }

  const sectionCount = chapter.sections.length;
  if (sectionCount === 0) {
    return buildEmptyChapterContent(chapter, outline.courseSkillIds);
  }

  const nodeIds = buildSectionNodeIds(chapterIndex, sectionCount);

  const docs = await db
    .select({
      title: courseSections.title,
      content: courseSections.contentMarkdown,
      outlineNodeKey: courseSections.outlineNodeKey,
    })
    .from(courseSections)
    .where(
      and(eq(courseSections.courseId, courseId), inArray(courseSections.outlineNodeKey, nodeIds)),
    );

  const sections = mapSectionsFromNodeIds(nodeIds, buildSectionDocMap(docs));

  const result: ChapterContent = {
    chapterTitle: chapter.title,
    chapterDescription: chapter.description ?? "",
    chapterSkillIds: chapter.skillIds ?? [],
    courseSkillIds: outline.courseSkillIds,
    sections,
  };

  await writeJsonCache(getChapterCacheKey(courseId, chapterIndex), result);
  return result;
}

export async function invalidateChapterCache(
  courseId: string,
  chapterIndex: number,
): Promise<void> {
  await deleteCacheKey(getChapterCacheKey(courseId, chapterIndex));
}

export async function invalidateCourseCache(courseId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(getOutlineCacheKey(courseId));
    const pattern = `course:chapter:${courseId}:*`;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  } catch {
    // Redis unavailable, skip invalidation
  }
}

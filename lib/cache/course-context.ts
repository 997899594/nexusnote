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
import { redis } from "@/lib/redis";

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

function getOutlineCacheKey(courseId: string): string {
  return `course:outline:${courseId}`;
}

function getChapterCacheKey(courseId: string, chapterIndex: number): string {
  return `course:chapter:${courseId}:${chapterIndex}`;
}

async function readJsonCache<T>(cacheKey: string): Promise<T | null> {
  try {
    const cached = await redis.get(cacheKey);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
}

async function writeJsonCache(cacheKey: string, value: unknown): Promise<void> {
  try {
    await redis.set(cacheKey, JSON.stringify(value), "EX", CACHE_TTL);
  } catch {
    // Redis unavailable, skip caching
  }
}

async function deleteCacheKey(cacheKey: string): Promise<void> {
  try {
    await redis.del(cacheKey);
  } catch {
    // Redis unavailable, skip invalidation
  }
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

  const result: CourseOutline = {
    courseTitle: course.title ?? "未知课程",
    courseSkillIds: course.outline.courseSkillIds ?? [],
    chapters: course.outline.chapters.map((ch) => ({
      title: ch.title,
      description: ch.description ?? "",
      skillIds: ch.skillIds ?? [],
      sections: ch.sections.map((s) => ({
        title: s.title,
        description: s.description ?? "",
      })),
    })),
  };

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
    return {
      chapterTitle: chapter.title,
      chapterDescription: chapter.description ?? "",
      chapterSkillIds: chapter.skillIds ?? [],
      courseSkillIds: outline.courseSkillIds,
      sections: [],
    };
  }

  const nodeIds = Array.from({ length: sectionCount }, (_, si) =>
    buildSectionOutlineNodeKey(chapterIndex, si),
  );

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

  const docMap = new Map<string, { title: string; text: string }>();
  for (const doc of docs) {
    if (doc.content && doc.outlineNodeKey) {
      docMap.set(doc.outlineNodeKey, { title: doc.title, text: doc.content });
    }
  }

  const sections: SectionContent[] = [];
  for (const nodeId of nodeIds) {
    const doc = docMap.get(nodeId);
    if (doc) {
      sections.push(doc);
    }
  }

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

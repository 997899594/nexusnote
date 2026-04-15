/**
 * Course Context Cache
 *
 * Redis-backed cache for course outline and chapter content.
 * Replaces N+1 queries with batch SQL + 5-minute TTL cache.
 * Graceful fallback: if Redis is unavailable, queries DB directly.
 */

import { and, courseSections, db, eq, inArray } from "@/db";
import { getCourseWithOutline } from "@/lib/learning/course-repository";
import { redis } from "@/lib/redis";

const CACHE_TTL = 300; // 5 minutes

// ============================================
// Types
// ============================================

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

// ============================================
// Cache Functions
// ============================================

export async function getCourseOutline(courseId: string): Promise<CourseOutline | null> {
  const cacheKey = `course:outline:${courseId}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable, fall through to DB
  }

  const course = await getCourseWithOutline(courseId);
  if (!course) return null;

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

  // Write back to cache
  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);
  } catch {
    // Redis unavailable, skip caching
  }

  return result;
}

export async function getChapterContent(
  courseId: string,
  chapterIndex: number,
): Promise<ChapterContent | null> {
  const cacheKey = `course:chapter:${courseId}:${chapterIndex}`;

  // Try cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {
    // Redis unavailable, fall through to DB
  }

  // Get outline to know section count
  const outline = await getCourseOutline(courseId);
  if (!outline) return null;

  const chapter = outline.chapters[chapterIndex];
  if (!chapter) return null;

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

  // Batch query: single SQL instead of N queries
  const nodeIds = Array.from(
    { length: sectionCount },
    (_, si) => `section-${chapterIndex + 1}-${si + 1}`,
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

  // Build ordered sections
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

  // Write back to cache
  try {
    await redis.set(cacheKey, JSON.stringify(result), "EX", CACHE_TTL);
  } catch {
    // Redis unavailable, skip caching
  }

  return result;
}

export async function invalidateChapterCache(
  courseId: string,
  chapterIndex: number,
): Promise<void> {
  try {
    await redis.del(`course:chapter:${courseId}:${chapterIndex}`);
  } catch {
    // Redis unavailable, skip
  }
}

export async function invalidateCourseCache(courseId: string): Promise<void> {
  try {
    // Delete outline cache
    await redis.del(`course:outline:${courseId}`);

    // Delete all chapter caches (scan pattern)
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
    // Redis unavailable, skip
  }
}

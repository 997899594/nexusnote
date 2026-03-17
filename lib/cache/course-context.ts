/**
 * Course Context Cache
 *
 * Redis-backed cache for course outline and chapter content.
 * Replaces N+1 queries with batch SQL + 5-minute TTL cache.
 * Graceful fallback: if Redis is unavailable, queries DB directly.
 */

import { and, courseSessions, db, documents, eq, inArray } from "@/db";
import { redis } from "@/lib/redis";

const CACHE_TTL = 300; // 5 minutes

// ============================================
// Types
// ============================================

interface OutlineSection {
  title: string;
}

interface OutlineChapter {
  title: string;
  sections: OutlineSection[];
}

export interface CourseOutline {
  courseTitle: string;
  chapters: OutlineChapter[];
}

interface SectionContent {
  title: string;
  text: string;
}

export interface ChapterContent {
  chapterTitle: string;
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

  // Query DB
  const [course] = await db
    .select({ title: courseSessions.title, outlineData: courseSessions.outlineData })
    .from(courseSessions)
    .where(eq(courseSessions.id, courseId))
    .limit(1);

  if (!course) return null;

  const outline = course.outlineData as {
    title?: string;
    chapters?: Array<{
      title: string;
      sections?: Array<{ title: string }>;
    }>;
  } | null;

  if (!outline?.chapters) return null;

  const result: CourseOutline = {
    courseTitle: course.title ?? "未知课程",
    chapters: outline.chapters.map((ch) => ({
      title: ch.title,
      sections: (ch.sections ?? []).map((s) => ({ title: s.title })),
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
    return { chapterTitle: chapter.title, sections: [] };
  }

  // Batch query: single SQL instead of N queries
  const nodeIds = Array.from(
    { length: sectionCount },
    (_, si) => `section-${chapterIndex + 1}-${si + 1}`,
  );

  const docs = await db
    .select({
      title: documents.title,
      content: documents.content,
      outlineNodeId: documents.outlineNodeId,
    })
    .from(documents)
    .where(and(eq(documents.courseId, courseId), inArray(documents.outlineNodeId, nodeIds)));

  // Build ordered sections
  const docMap = new Map<string, { title: string; text: string }>();
  for (const doc of docs) {
    if (doc.content && doc.outlineNodeId) {
      const text = Buffer.isBuffer(doc.content) ? doc.content.toString("utf-8") : "";
      if (text) {
        docMap.set(doc.outlineNodeId, { title: doc.title, text });
      }
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

// app/api/learn/progress/route.ts

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { courseSessions, db } from "@/db";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";

const RequestSchema = z.object({
  courseId: z.string().uuid(),
  sectionNodeId: z.string().min(1),
});

interface OutlineSection {
  title: string;
  description?: string;
}

interface OutlineChapter {
  title: string;
  description?: string;
  sections: OutlineSection[];
}

interface OutlineData {
  title?: string;
  description?: string;
  chapters?: OutlineChapter[];
}

interface CourseProgress {
  currentChapter: number;
  completedChapters: number[];
  completedSections: string[];
  totalChapters: number;
  startedAt: string;
  completedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new APIError("未登录", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const { courseId, sectionNodeId } = RequestSchema.parse(body);

    // Fetch course session
    const [course] = await db
      .select({
        id: courseSessions.id,
        userId: courseSessions.userId,
        progress: courseSessions.progress,
        outlineData: courseSessions.outlineData,
      })
      .from(courseSessions)
      .where(eq(courseSessions.id, courseId))
      .limit(1);

    if (!course || course.userId !== session.user.id) {
      throw new APIError("课程不存在", 404, "NOT_FOUND");
    }

    // Build updated progress
    const existing = (course.progress ?? {}) as Partial<CourseProgress>;
    const completedSections = existing.completedSections ?? [];

    // Deduplicate: skip if already completed
    if (completedSections.includes(sectionNodeId)) {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    completedSections.push(sectionNodeId);

    // Check chapter completion: if all sections in a chapter are done, mark chapter complete
    const outline = course.outlineData as OutlineData | null;
    const chapters = outline?.chapters ?? [];
    const completedChapters = existing.completedChapters ?? [];

    for (let chIdx = 0; chIdx < chapters.length; chIdx++) {
      if (completedChapters.includes(chIdx)) continue;

      const chapterSections = chapters[chIdx].sections ?? [];
      const allDone = chapterSections.every((_, secIdx) => {
        const nodeId = `section-${chIdx + 1}-${secIdx + 1}`;
        return completedSections.includes(nodeId);
      });

      if (allDone && chapterSections.length > 0) {
        completedChapters.push(chIdx);
      }
    }

    // Check full course completion
    const allChaptersDone = chapters.length > 0 && completedChapters.length >= chapters.length;
    const completedAt = allChaptersDone
      ? (existing.completedAt ?? new Date().toISOString())
      : (existing.completedAt ?? "");

    const updatedProgress: CourseProgress = {
      currentChapter: existing.currentChapter ?? 0,
      completedChapters,
      completedSections,
      totalChapters: chapters.length,
      startedAt: existing.startedAt ?? new Date().toISOString(),
      completedAt,
    };

    await db
      .update(courseSessions)
      .set({ progress: updatedProgress, updatedAt: new Date() })
      .where(eq(courseSessions.id, courseId));

    // If course just completed, trigger skill discovery asynchronously
    if (allChaptersDone && !existing.completedAt) {
      triggerSkillDiscovery(session.user.id).catch((err) => {
        console.error("[LearnProgress] Skill discovery failed:", err);
      });
    }

    return NextResponse.json({
      ok: true,
      completedSections,
      completedChapters,
      courseCompleted: allChaptersDone,
    });
  } catch (error) {
    return handleError(error);
  }
}

const ChapterSchema = z.object({
  courseId: z.string().uuid(),
  currentChapter: z.number().int().min(0),
});

/** Persist current chapter position (called when user switches chapters) */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      throw new APIError("未登录", 401, "UNAUTHORIZED");
    }

    const body = await request.json();
    const { courseId, currentChapter } = ChapterSchema.parse(body);

    const [course] = await db
      .select({
        id: courseSessions.id,
        userId: courseSessions.userId,
        progress: courseSessions.progress,
      })
      .from(courseSessions)
      .where(eq(courseSessions.id, courseId))
      .limit(1);

    if (!course || course.userId !== session.user.id) {
      throw new APIError("课程不存在", 404, "NOT_FOUND");
    }

    const existing = (course.progress ?? {}) as Partial<CourseProgress>;
    const updatedProgress: CourseProgress = {
      currentChapter,
      completedChapters: existing.completedChapters ?? [],
      completedSections: existing.completedSections ?? [],
      totalChapters: existing.totalChapters ?? 0,
      startedAt: existing.startedAt ?? new Date().toISOString(),
      completedAt: existing.completedAt ?? "",
    };

    await db
      .update(courseSessions)
      .set({ progress: updatedProgress, updatedAt: new Date() })
      .where(eq(courseSessions.id, courseId));

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

/** Fire-and-forget skill discovery + relationship inference */
async function triggerSkillDiscovery(userId: string) {
  const { discoverAndSaveSkills } = await import("@/lib/skills/discovery");
  const { inferSkillRelationships } = await import("@/lib/skills/relationships");

  const discovered = await discoverAndSaveSkills(userId);
  if (discovered.length > 0) {
    const slugs = discovered.map((s) => s.slug);
    await inferSkillRelationships(slugs);
  }
}

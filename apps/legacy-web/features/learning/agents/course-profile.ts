/**
 * Course Profile Service - NexusNote 2026
 *
 * 职责：
 * 1. 课程大纲和元数据管理
 * 2. 课程进度追踪
 * 3. 章节内容 CRUD
 *
 * 注意：学习者画像管理已迁移到 services/interview-session.ts
 */

import { courseChapters, courseProfiles, db, eq } from "@nexusnote/db";
import { z } from "zod";
import { type OutlineData, OutlineSchema } from "@/features/shared/ai/types/course";

export type { OutlineData } from "@/features/shared/ai/types/course";

export const CourseProfileSchema = z.object({
  userId: z.string().uuid(),
  id: z.string().uuid(),
  outlineData: OutlineSchema,
  designReason: z.string().optional(),
});

export type CourseProfile = z.infer<typeof CourseProfileSchema>;

/**
 * 保存课程大纲数据（大纲确认后调用）
 */
export async function saveCourseProfile({
  userId,
  id: providedId,
  outlineData,
  designReason,
}: {
  userId: string;
  id?: string;
  outlineData: OutlineData;
  designReason?: string;
}) {
  const id = providedId || crypto.randomUUID();
  const outlineMarkdown = convertOutlineToMarkdown(outlineData);

  await db
    .insert(courseProfiles)
    .values({
      id,
      userId,
      title: outlineData.title,
      description: outlineData.description,
      difficulty: outlineData.difficulty,
      estimatedMinutes: outlineData.estimatedMinutes,
      outlineData: outlineData as any,
      outlineMarkdown,
      designReason,
    })
    .onConflictDoUpdate({
      target: courseProfiles.id,
      set: {
        title: outlineData.title,
        description: outlineData.description,
        difficulty: outlineData.difficulty,
        estimatedMinutes: outlineData.estimatedMinutes,
        outlineData: outlineData as any,
        outlineMarkdown,
        designReason,
        updatedAt: new Date(),
      },
    });

  return id;
}

/**
 * 加载课程画像
 */
export async function getCourseProfile(id: string) {
  const result = await db.query.courseProfiles.findFirst({
    where: eq(courseProfiles.id, id),
  });

  if (!result) {
    throw new Error(`课程不存在: ${id}`);
  }

  return {
    ...result,
    outlineData: result.outlineData as OutlineData,
  };
}

/**
 * 更新课程进度
 */
export async function updateCourseProgress(
  id: string,
  {
    currentChapter,
    currentSection,
  }: {
    currentChapter: number;
    currentSection: number;
  },
) {
  await db
    .update(courseProfiles)
    .set({
      currentChapter,
      currentSection,
      updatedAt: new Date(),
    })
    .where(eq(courseProfiles.id, id));
}

/**
 * 保存课程章节内容
 */
export async function saveCourseChapter({
  profileId,
  chapterIndex,
  sectionIndex,
  title,
  contentMarkdown,
}: {
  profileId: string;
  chapterIndex: number;
  sectionIndex: number;
  title: string;
  contentMarkdown: string;
}) {
  const existing = await db.query.courseChapters.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.profileId, profileId),
        eq(t.chapterIndex, chapterIndex),
        eq(t.sectionIndex, sectionIndex),
      ),
  });

  if (existing) {
    await db
      .update(courseChapters)
      .set({
        title,
        contentMarkdown,
        updatedAt: new Date(),
      })
      .where(eq(courseChapters.id, existing.id));
  } else {
    await db.insert(courseChapters).values({
      id: crypto.randomUUID(),
      profileId,
      chapterIndex,
      sectionIndex,
      title,
      contentMarkdown,
    });
  }

  await db
    .update(courseProfiles)
    .set({
      currentChapter: chapterIndex,
      currentSection: sectionIndex,
      updatedAt: new Date(),
    })
    .where(eq(courseProfiles.id, profileId));
}

/**
 * 获取课程章节内容
 */
export async function getCourseChapters(profileId: string) {
  return db.query.courseChapters.findMany({
    where: eq(courseChapters.profileId, profileId),
    orderBy: (t) => [t.chapterIndex, t.sectionIndex],
  });
}

/**
 * 获取特定章节内容
 */
export async function getCourseChapter(
  profileId: string,
  chapterIndex: number,
  sectionIndex: number,
) {
  return db.query.courseChapters.findFirst({
    where: (t, { and, eq }) =>
      and(
        eq(t.profileId, profileId),
        eq(t.chapterIndex, chapterIndex),
        eq(t.sectionIndex, sectionIndex),
      ),
  });
}

function convertOutlineToMarkdown(outline: OutlineData): string {
  let markdown = `# ${outline.title}\n\n`;

  if (outline.description) {
    markdown += `${outline.description}\n\n`;
  }

  markdown += `**难度:** ${outline.difficulty} | **预估时长:** ${outline.estimatedMinutes} 分钟\n\n`;

  if (outline.reason) {
    markdown += `**课程设计理由:** ${outline.reason}\n\n`;
  }

  markdown += `---\n\n`;

  if (outline.modules && outline.modules.length > 0) {
    for (const module of outline.modules) {
      markdown += `## ${module.title}\n\n`;

      for (const chapter of module.chapters) {
        markdown += `### ${chapter.title}\n`;
        if (chapter.contentSnippet) {
          markdown += `\n${chapter.contentSnippet}\n`;
        }
        markdown += "\n";
      }

      markdown += "\n";
    }
  }

  return markdown;
}

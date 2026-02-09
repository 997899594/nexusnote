/**
 * Course Profile Service - NexusNote 2026
 *
 * 职责：
 * 1. 保存用户的课程画像（Interview Agent 收集的信息）
 * 2. 加载课程画像（后续 Agent 使用）
 * 3. 更新课程进度和内容
 *
 * 参考：
 * - AI SDK v6：使用最新的 generateText 和类型安全方案
 * - 现有实现：database.ts、document-parser.ts 的模式
 *
 * 注意：这个文件包含服务端函数，应该只在服务端导入
 * - 在 API 路由中导入（如 /api/ai/route.ts）
 * - 在 Server Component 中导入
 * 不应该在客户端代码中直接导入数据库操作函数
 */

import { db, courseProfiles, courseChapters, eq } from "@nexusnote/db";
import { z } from "zod";
import { OutlineSchema, type OutlineData } from "@/lib/ai/types/course";

// Re-export for convenience
export { type OutlineData } from "@/lib/ai/types/course";

/**
 * 课程画像数据结构
 */
export const CourseProfileSchema = z.object({
  userId: z.string().uuid(),
  id: z.string().uuid(), // 统一使用 id
  goal: z.string(),
  background: z.string(),
  targetOutcome: z.string(),
  cognitiveStyle: z.string(),
  outlineData: OutlineSchema,
  designReason: z.string(),
});

export type CourseProfile = z.infer<typeof CourseProfileSchema>;

/**
 * 保存课程画像（Interview Agent 调用）
 *
 * 返回：id（用于跳转到 /learn/[id]）
 */
export async function saveCourseProfile({
  userId,
  id: providedId,
  goal,
  background,
  targetOutcome,
  cognitiveStyle,
  outlineData,
  designReason,
}: Partial<Pick<CourseProfile, "id">> &
  Omit<CourseProfile, "id"> & {
    outlineData: OutlineData;
  }) {
  // 使用提供的 id 或生成新的
  const id = providedId || crypto.randomUUID();

  // 转换大纲为 Markdown 格式（便于流式渲染到 Tiptap）
  const outlineMarkdown = convertOutlineToMarkdown(outlineData);

  try {
    // 架构师系统级修复：使用 UPSERT 模式确保幂等性，防止重复提交导致的错误
    await db
      .insert(courseProfiles)
      .values({
        id,
        userId,
        goal,
        background,
        targetOutcome,
        cognitiveStyle,
        title: outlineData.title,
        description: outlineData.description,
        difficulty: outlineData.difficulty,
        estimatedMinutes: outlineData.estimatedMinutes,
        outlineData: outlineData as any, // Drizzle jsonb
        outlineMarkdown,
        designReason,
      })
      .onConflictDoUpdate({
        target: courseProfiles.id,
        set: {
          goal,
          background,
          targetOutcome,
          cognitiveStyle,
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

    console.log(`[Course Profile] Atomic Upsert Success: ${id}`);
    return id;
  } catch (error) {
    console.error("[Course Profile] 保存失败:", error);
    throw error;
  }
}

/**
 * 加载课程画像（后续 Agent 或页面调用）
 *
 * 用途：
 * - /learn 页面初始化
 * - 后续 Agent 需要用户背景信息时
 */
export async function getCourseProfile(id: string) {
  try {
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
  } catch (error) {
    console.error("[Course Profile] 加载失败:", error);
    throw error;
  }
}

/**
 * 更新课程进度
 *
 * 用途：/learn 页面更新当前章节
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
  try {
    await db
      .update(courseProfiles)
      .set({
        currentChapter,
        currentSection,
        updatedAt: new Date(),
      })
      .where(eq(courseProfiles.id, id));

    console.log(
      `[Course Profile] 更新进度: ${currentChapter}-${currentSection}`,
    );
  } catch (error) {
    console.error("[Course Profile] 更新失败:", error);
    throw error;
  }
}

/**
 * 保存课程章节内容（Course Generation Agent 调用）
 *
 * 用途：生成的课程内容流式保存到数据库
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
  try {
    // 检查是否已存在，如果存在则更新
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

    // 系统级改进：保存章节后，自动同步推进课程主表的进度
    // 这确保了 profile.currentChapter 始终反映真实的生成进度
    await db
      .update(courseProfiles)
      .set({
        currentChapter: chapterIndex,
        currentSection: sectionIndex,
        updatedAt: new Date(),
      })
      .where(eq(courseProfiles.id, profileId));

    console.log(
      `[Course Chapter] Atomic Save: Profile ${profileId} progressed to ${chapterIndex}-${sectionIndex}`,
    );
  } catch (error) {
    console.error("[Course Chapter] 保存失败:", error);
    throw error;
  }
}

/**
 * 获取课程章节内容（/learn 页面调用）
 *
 * 返回：按章节索引排序的内容，用于 Tiptap 渲染
 */
export async function getCourseChapters(profileId: string) {
  try {
    const chapters = await db.query.courseChapters.findMany({
      where: eq(courseChapters.profileId, profileId),
      orderBy: (t) => [t.chapterIndex, t.sectionIndex],
    });

    return chapters;
  } catch (error) {
    console.error("[Course Chapters] 加载失败:", error);
    throw error;
  }
}

/**
 * 获取特定章节内容
 */
export async function getCourseChapter(
  profileId: string,
  chapterIndex: number,
  sectionIndex: number,
) {
  try {
    const chapter = await db.query.courseChapters.findFirst({
      where: (t, { and, eq }) =>
        and(
          eq(t.profileId, profileId),
          eq(t.chapterIndex, chapterIndex),
          eq(t.sectionIndex, sectionIndex),
        ),
    });

    return chapter;
  } catch (error) {
    console.error("[Course Chapter] 加载失败:", error);
    throw error;
  }
}

/**
 * 辅助函数：将大纲转换为 Markdown 格式
 * 用于流式渲染到 Tiptap
 *
 * 格式化为：
 * # 课程标题
 * ## 模块 1
 * ### 章节 1
 * ### 章节 2
 * ## 模块 2
 * ...
 */
function convertOutlineToMarkdown(outline: OutlineData): string {
  let markdown = `# ${outline.title}\n\n`;

  if (outline.description) {
    markdown += `${outline.description}\n\n`;
  }

  markdown += `**难度:** ${outline.difficulty} | **预估时长:** ${outline.estimatedMinutes} 分钟\n\n`;

  markdown += `**课程设计理由:** ${outline.reason}\n\n`;

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

/**
 * 验证 Interview Context 完整性
 * 确保所有必需信息都已收集
 */
export function isInterviewComplete(context: {
  goal?: string;
  background?: string;
  targetOutcome?: string;
  cognitiveStyle?: string;
}): boolean {
  return !!(
    context.goal &&
    context.background &&
    context.targetOutcome &&
    context.cognitiveStyle
  );
}

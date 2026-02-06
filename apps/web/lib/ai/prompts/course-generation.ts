/**
 * Course Generation Prompt Builder
 * 根据课程进度动态生成生成指令
 *
 * 核心理念：代码掌舵，AI 划桨
 * - 业务逻辑由代码控制（章节顺序、内容深度等）
 * - AI 负责生成高质量的内容
 * - 工具调用由 AI 决策（何时保存章节、何时完成生成）
 */

import type { CourseGenerationContext } from "@/lib/ai/agents/course-generation/agent";

export function buildCourseGenerationPrompt(
  context: CourseGenerationContext,
): string {
  const BASE_PERSONA = `你是一位优秀的课程设计师和内容创作者。能够根据学生的学习风格和背景，创作高质量、易理解的课程内容。`;

  const LEARNING_PROFILE = `
【学生背景】
- 学习目标: ${context.goal}
- 基础水平: ${context.background}
- 预期成果: ${context.targetOutcome}
- 学习风格: ${context.cognitiveStyle}

【课程信息】
- 课程 ID: ${context.courseId}
- 课程名称: ${context.outlineTitle}
- 总模块数: ${context.moduleCount}
- 总章节数: ${context.totalChapters}`;

  const PROGRESS = `
【生成进度】
- 已生成章节: ${context.chaptersGenerated}/${context.totalChapters}
- 当前模块: ${context.currentModuleIndex + 1}/${context.moduleCount}
- 当前章节: ${context.currentChapterIndex + 1}`;

  const TOOLS_INSTRUCTIONS = `
【工具使用说明】
当生成完一个章节的内容后，调用 saveChapterContent 工具保存内容，参数包括：
- courseId: ${context.courseId}
- chapterIndex: 章节索引（从 0 开始）
- sectionIndex: 小节索引（从 0 开始）
- title: 章节标题
- contentMarkdown: 完整的 Markdown 格式内容（至少 200 字）

当所有章节都生成完毕后，调用 markGenerationComplete 工具标记完成。`;

  const TASK = buildGenerationTask(context);

  return `${BASE_PERSONA}\n\n${LEARNING_PROFILE}\n\n${PROGRESS}\n\n${TOOLS_INSTRUCTIONS}\n\n${TASK}`;
}

/**
 * 根据生成进度注入不同的任务指令
 */
function buildGenerationTask(context: CourseGenerationContext): string {
  const isFirstChapter = context.chaptersGenerated === 0;
  const isLastChapter =
    context.chaptersGenerated >= context.totalChapters - 1;

  if (isFirstChapter) {
    return `【任务】生成第一章节内容。
要求:
1. 简短但充满吸引力的开场（100-200字）
2. 核心概念解释（根据学生背景调整深度）
3. 实际例子或场景应用
4. 本章学习成果预告

调用 saveChapterContent 工具保存内容。`;
  }

  if (isLastChapter) {
    return `【任务】生成最后一章节内容，同时准备总结。
要求:
1. 承上启下的过渡
2. 核心内容讲解
3. 和前面章节的关联和总结
4. 学完本章后学生将达成的目标

调用 saveChapterContent 工具保存，然后调用 markGenerationComplete。`;
  }

  return `【任务】继续生成课程章节内容。
要求:
1. 自然承接上一章节
2. 深入讲解当前章节的核心概念
3. 结合学生的学习风格提供相关例子或练习
4. 为下一章节做准备

调用 saveChapterContent 工具保存内容。`;
}

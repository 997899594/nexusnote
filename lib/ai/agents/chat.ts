/**
 * CHAT Agent - 通用对话
 */

import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { getCourseOutline } from "@/lib/cache/course-context";
import type { ChatMetadata } from "@/types/metadata";
import { isLearnMetadata } from "@/types/metadata";
import { aiProvider } from "../core";
import { createToolContext } from "../core/tool-context";
import { buildInstructions, CHAT_PROMPT } from "../prompts/chat";
import { buildAgentTools } from "../tools";

export interface PersonalizationOptions {
  personaPrompt?: string;
  userContext?: string;
  userId?: string;
  courseId?: string;
  metadata?: ChatMetadata;
}

/**
 * 创建 CHAT Agent
 *
 * 学习页面：只注入轻量 outline hint（~200 字符），
 * 详细内容由 agent 按需调用 loadLearnContext 工具获取。
 */
export async function createChatAgent(options?: PersonalizationOptions) {
  if (!options?.userId) {
    throw new Error("Chat agent requires userId");
  }

  const userContextParts = options.userContext ? [options.userContext] : [];

  // 学习页面：轻量 outline hint（标题+小节列表），不加载内容
  if (options.courseId && isLearnMetadata(options.metadata)) {
    const outline = await getCourseOutline(options.courseId);
    if (outline) {
      const chapter = outline.chapters[options.metadata.chapterIndex];
      const hint = [
        "## 当前学习上下文",
        `课程：${options.metadata.courseTitle}`,
        `当前章节：第 ${options.metadata.chapterIndex + 1} 章 - ${options.metadata.chapterTitle}`,
        chapter ? `小节：${chapter.sections.map((s) => s.title).join("、")}` : "",
        "提示：使用 loadLearnContext 工具获取章节详细内容后再回答问题。",
      ]
        .filter(Boolean)
        .join("\n");
      userContextParts.push(hint);
    }
  }

  const instructions = buildInstructions(CHAT_PROMPT, {
    personaPrompt: options.personaPrompt,
    userContext: userContextParts.length > 0 ? userContextParts.join("\n\n") : undefined,
  });

  const ctx = createToolContext({
    userId: options.userId,
    resourceId: options.courseId,
  });
  const chatTools = buildAgentTools("chat", ctx) as ToolSet;

  return new ToolLoopAgent({
    id: "nexusnote-chat",
    model: aiProvider.chatModel,
    instructions,
    tools: chatTools,
    stopWhen: stepCountIs(20),
  });
}

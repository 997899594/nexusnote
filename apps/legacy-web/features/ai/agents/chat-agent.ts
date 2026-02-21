/**
 * Chat Agent - 通用聊天 Agent
 *
 * 2026 架构：基于 AI SDK v6 ToolLoopAgent
 */

import { type InferAgentUIMessage, stepCountIs, ToolLoopAgent, tool } from "ai";
import { z } from "zod";
import { aiProvider } from "../provider";
import type { AgentContext } from "./factory";

/**
 * Chat Agent 调用选项
 */
export const ChatCallOptionsSchema = z.object({
  userId: z.string(),
  sessionId: z.string().optional(),
  ragContext: z.string().optional(),
  documentContext: z.string().optional(),
  editMode: z.boolean().optional(),
  enableWebSearch: z.boolean().optional(),
});

export type ChatCallOptions = z.infer<typeof ChatCallOptionsSchema>;

/**
 * 获取 Chat 模型
 */
function getChatModel() {
  if (!aiProvider.isConfigured()) {
    throw new Error("AI Provider not configured. Please set AI_302_API_KEY.");
  }
  return aiProvider.getChatModel();
}

/**
 * 构建 System Prompt
 */
function buildInstructions(options: ChatCallOptions): string {
  const { ragContext, documentContext, editMode } = options;

  if (documentContext && ragContext) {
    return `你是 NexusNote 知识库助手。

## 当前文档内容
${documentContext}

## 知识库相关内容
${ragContext}

## 回答规则
1. 优先基于"当前文档内容"回答
2. 需要补充时参考"知识库相关内容"
3. 引用时使用 [1], [2] 等标记
4. 保持简洁专业`;
  }

  if (editMode) {
    return `你是 NexusNote 文档编辑助手。

## 你的能力
使用 editDocument 工具来修改文档。

## 编辑策略
- 结构化操作（删除、替换）→ 直接调用 editDocument
- 长内容生成 → 先输出预览，询问用户确认

## 目标
帮助用户高效编辑文档`;
  }

  if (ragContext) {
    return `你是 NexusNote 知识库助手。请根据知识库内容回答问题。
优先使用知识库信息，引用时使用 [1], [2] 等标记。`;
  }

  return `你是 NexusNote 智能助手，帮助用户写作、整理知识和学习。

## 核心原则
1. **主动**：用户需要帮助时主动提供建议
2. **简洁**：除非用户要求长篇，否则保持简练
3. **有益**：提供下一步行动建议

## 特殊场景
- 长内容生成：使用 draftContent 工具
- 信息查询：优先使用知识库`;

  // 联网搜索
}

/**
 * Chat 工具定义
 */
const chatTools = {
  // 编辑工具
  editDocument: tool({
    description: "编辑文档内容",
    inputSchema: z.object({
      documentId: z.string(),
      targetId: z.string(),
      action: z.enum(["replace", "insert_after", "insert_before", "delete"]),
      content: z.string(),
    }),
    execute: async () => ({ success: true }),
  }),

  // 搜索工具
  searchWeb: tool({
    description: "联网搜索最新信息",
    inputSchema: z.object({
      query: z.string(),
    }),
    execute: async ({ query }) => {
      // TODO: 实现联网搜索
      return { results: [], query };
    },
  }),
};

/**
 * 创建 Chat Agent
 */
export function createChatAgent(context: AgentContext): ToolLoopAgent {
  return new ToolLoopAgent({
    id: "nexusnote-chat",
    model: getChatModel(),
    tools: chatTools,
    maxOutputTokens: 4096,
    callOptionsSchema: ChatCallOptionsSchema,

    prepareCall: ({ options, ...rest }) => {
      const chatOptions = (options ?? {}) as ChatCallOptions;
      const instructions = buildInstructions(chatOptions);

      let activeTools: Array<keyof typeof chatTools> | undefined;
      if (chatOptions.editMode) {
        activeTools = ["editDocument"];
      } else if (chatOptions.enableWebSearch) {
        activeTools = ["searchWeb"];
      }

      return {
        ...rest,
        options: { ...chatOptions, userId: context.userId },
        instructions,
        activeTools,
      };
    },

    stopWhen: stepCountIs(3),
  });
}

/**
 * 导出类型
 */
export type ChatAgentMessage = InferAgentUIMessage<ReturnType<typeof createChatAgent>>;

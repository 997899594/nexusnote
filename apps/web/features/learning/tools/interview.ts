/**
 * Interview Tools - NexusNote 2026 Architecture
 * 严格遵循文档3的工具协议规范
 *
 * 设计原则：
 * 1. 所有工具必须有明确的语义描述
 * 2. 使用 Zod Schema 进行物理层防御（防刷屏、防乱填）
 * 3. 支持前端类型安全和自动补全
 */

import { type ToolSet, tool } from "ai";
import { z } from "zod";
import { searchWeb } from "@/features/chat/tools/chat/web";

/**
 * presentOptions - 展示 UI 交互卡片
 *
 * 语义：我问了一个问题，为了方便用户，请在文本下方显示这些选项
 * 调用时机：当询问了具体问题后，需要降低用户输入成本时
 * 严格限制：必须在生成一段引导性的自然语言回复之后调用
 */
export const presentOptionsTool = tool({
  description: `向用户展示可点击的选项卡片。在询问用户具体问题后调用此工具。`,

  inputSchema: z.object({
    replyToUser: z.string().describe("在显示选项卡片之前，对用户说的话（回复用户并引出问题）。"),

    question: z.string().describe('卡片标题，5-10个字。例如："选择方向"、"您的水平"'),

    options: z.array(z.string()).min(2).max(4).describe("选项列表，必须提供2-4个字符串"),

    targetField: z
      .enum(["goal", "background", "targetOutcome", "cognitiveStyle", "general"])
      .describe(
        "问题类型：goal=学习目标, background=背景水平, targetOutcome=预期成果, cognitiveStyle=学习风格, general=通用",
      ),

    allowSkip: z.boolean().optional().describe("是否允许跳过，可选"),

    multiSelect: z.boolean().optional().describe("是否多选，可选"),
  }),
});

// updateProfile 和 resetField 工具已删除
// 状态管理由前端负责，AI 只负责生成内容

/**
 * 导出所有 Interview 工具的集合
 *
 * 职责分离原则：
 * - presentOptions: AI 生成选项供用户选择
 * - 状态管理由前端负责，不需要 updateProfile
 *
 * 注意：generateOutline 已被 designCurriculum 替代（P2）
 */
export const interviewTools: ToolSet = {
  presentOptions: presentOptionsTool,
  searchWeb,
};

/**
 * 导出工具名称类型（用于前端类型安全）
 */
export type InterviewToolName = keyof typeof interviewTools;

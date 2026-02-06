/**
 * Interview Tools - NexusNote 2026 Architecture
 * 严格遵循文档3的工具协议规范
 *
 * 设计原则：
 * 1. 所有工具必须有明确的语义描述
 * 2. 使用 Zod Schema 进行物理层防御（防刷屏、防乱填）
 * 3. 支持前端类型安全和自动补全
 */

import { tool } from 'ai';
import { z } from 'zod';
import { saveCourseProfile } from '@/lib/ai/profile/course-profile';

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
    question: z.string()
      .describe('卡片标题，5-10个字。例如："选择方向"、"您的水平"'),

    options: z.array(z.string())
      .min(2)
      .max(4)
      .describe('选项列表，必须提供2-4个字符串'),

    targetField: z.enum(['goal', 'background', 'targetOutcome', 'cognitiveStyle', 'general'])
      .describe('问题类型：goal=学习目标, background=背景水平, targetOutcome=预期成果, cognitiveStyle=学习风格, general=通用'),

    allowSkip: z.boolean().optional()
      .describe('是否允许跳过，可选'),

    multiSelect: z.boolean().optional()
      .describe('是否多选，可选'),
  }),

  execute: async () => ({ status: 'ui_rendered' }),
});

// updateProfile 和 resetField 工具已删除
// 状态管理由前端负责，AI 只负责生成内容

/**
 * generateOutline - 生成课程大纲
 *
 * 语义：信息收集完毕，生成个性化课程
 * 调用时机：仅在收集完所有必需信息（goal, background, targetOutcome, cognitiveStyle）后调用
 */
const generateOutlineSchema = z.object({
  title: z.string()
    .describe('课程标题。例如："Python Web开发入门"'),

  description: z.string()
    .describe('课程描述（2-3句话），说明这门课程的核心价值和适合人群'),

  difficulty: z.enum(['beginner', 'intermediate', 'advanced'])
    .describe('难度级别，基于用户的 background 决定'),

  estimatedMinutes: z.number()
    .min(30)
    .describe('预估学习时长（分钟），基于学习难度和深度合理估算'),

  modules: z.array(
    z.object({
      title: z.string()
        .describe('模块标题。例如："Python 基础语法"'),
      chapters: z.array(
        z.object({
          title: z.string()
            .describe('章节标题。例如："变量与数据类型"'),
          contentSnippet: z.string().optional()
            .describe('章节简介（可选），1-2句话说明这一章会学什么'),
        })
      ),
    })
  )
    .min(2, "最少2个模块")
    .max(20, "最多20个模块")
    .describe('课程模块列表。模块数量应根据 targetOutcome 的复杂度动态调整'),

  reason: z.string()
    .describe('为什么这样设计课程结构？基于用户的目标、背景和学习风格说明设计理念。'),
});

export const generateOutlineTool = tool({
  description: `生成个性化课程大纲。仅在收集完所有必需信息（goal, background, targetOutcome, cognitiveStyle）后调用。模块数量应根据 targetOutcome 的复杂度灵活调整。`,
  inputSchema: generateOutlineSchema,
  execute: async (params: z.infer<typeof generateOutlineSchema>) => {
    console.log('[generateOutline] 开始生成大纲:', params.title);

    // ⚠️ 注意：userId 和完整的用户信息需要从调用上下文中获取
    // 这会在 /api/ai 或 /app/create 中传递
    // 当前这里无法直接访问，会由前端在收到 outline 后调用 saveCourseProfile

    return {
      status: 'outline_generated',
      ...params,
      // 返回 outline 数据，前端会用 courseId 和用户信息保存到数据库
    };
  },
});

/**
 * 导出所有 Interview 工具的集合
 *
 * 职责分离原则：
 * - presentOptions: AI 生成选项供用户选择
 * - generateOutline: AI 生成课程大纲
 * - 状态管理由前端负责，不需要 updateProfile
 */
export const interviewTools = {
  presentOptions: presentOptionsTool,
  generateOutline: generateOutlineTool,
};

/**
 * 导出工具名称类型（用于前端类型安全）
 */
export type InterviewToolName = keyof typeof interviewTools;

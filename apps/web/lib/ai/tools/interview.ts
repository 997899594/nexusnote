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

/**
 * presentOptions - 展示 UI 交互卡片
 *
 * 语义：我问了一个问题，为了方便用户，请在文本下方显示这些选项
 * 调用时机：当询问了具体问题后，需要降低用户输入成本时
 * 严格限制：必须在生成一段引导性的自然语言回复之后调用
 */
export const presentOptionsTool = tool({
  description: `向用户展示可点击的选项卡片。在询问用户具体问题后调用此工具。

示例调用：
presentOptions({
  question: "选择方向",
  options: ["Web开发", "数据科学", "AI开发", "移动开发"],
  targetField: "goal"
})`,
  inputSchema: z.object({
    question: z.string()
      .describe('卡片标题，5-10个字。例如："选择方向"、"您的水平"'),

    options: z.array(z.string())
      .min(2)
      .max(4)
      .describe('选项列表，必须提供2-4个字符串'),

    targetField: z.enum(['goal', 'background', 'time', 'general'])
      .describe('问题类型：goal=学习目标, background=背景水平, time=时间投入, general=通用'),

    allowSkip: z.boolean().optional()
      .describe('是否允许跳过，可选'),

    multiSelect: z.boolean().optional()
      .describe('是否多选，可选'),
  }),
  execute: async () => ({ status: 'ui_rendered' }),
});

/**
 * updateProfile - 静默状态更新
 *
 * 语义：我听懂了用户的意图，请更新后台数据
 * 调用时机：当从对话中识别到 goal/background/time 信息时
 * 机会主义：如果用户一次性提到多个维度，可以一次性更新多个字段
 */
const updateProfileSchema = z.object({
  updates: z.object({
    goal: z.string().optional()
      .describe('学习目标，如"Python编程"、"AI入门"、"Web全栈开发"'),
    background: z.string().optional()
      .describe('学习背景/水平，如"零基础"、"有编程经验"、"熟练开发者"'),
    time: z.string().optional()
      .describe('可用时间/学习深度，如"每周5小时"、"全职学习"、"快速入门"'),
  }).describe('需要更新的字段（至少提供一个）'),

  reasoning: z.string()
    .describe('提取该值的简短理由，用于调试和日志分析。例如："用户明确说了想学Python"'),
});

export const updateProfileTool = tool({
  description: `更新用户的学习档案信息。当从对话中识别到目标、背景或时间信息时调用。`,
  inputSchema: updateProfileSchema,
  execute: async (params: z.infer<typeof updateProfileSchema>) => {
    // 客户端工具：由前端处理实际更新
    console.log('[updateProfile]', params);
    return { status: 'updated', ...params };
  },
});

/**
 * resetField - 状态重置
 *
 * 语义：用户觉得自己选错了/说错了，请求回滚
 * 调用时机：用户明确表示要修改之前的选择时
 */
const resetFieldSchema = z.object({
  field: z.enum(['goal', 'background', 'time', 'all'])
    .describe('需要清空的字段。选择 "all" 将重置所有字段，重新开始访谈。'),
});

export const resetFieldTool = tool({
  description: `重置用户之前的选择。当用户明确表示要修改之前的选择时调用。`,
  inputSchema: resetFieldSchema,
  execute: async (params: z.infer<typeof resetFieldSchema>) => {
    console.log('[resetField]', params);
    return { status: 'reset', ...params };
  },
});

/**
 * generateOutline - 生成课程大纲
 *
 * 语义：信息收集完毕，生成个性化课程
 * 调用时机：仅在收集完所有必需信息（goal, background, time）后调用
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
    .describe('预估学习时长（分钟），基于用户的 time 预算合理估算'),

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
    .min(3, "至少需要3个模块")
    .max(8, "最多8个模块，避免课程过于庞大")
    .describe('课程模块列表，每个模块包含多个章节'),

  reason: z.string()
    .describe('为什么这样设计课程结构？基于用户的背景和目标说明设计理念（2-3句话）。'),
});

export const generateOutlineTool = tool({
  description: `生成个性化课程大纲。仅在收集完所有必需信息（goal, background, time）后调用。`,
  inputSchema: generateOutlineSchema,
  execute: async (params: z.infer<typeof generateOutlineSchema>) => {
    console.log('[generateOutline]', params.title);
    return { status: 'outline_generated', ...params };
  },
});

/**
 * 导出所有 Interview 工具的集合
 */
export const interviewTools = {
  presentOptions: presentOptionsTool,
  updateProfile: updateProfileTool,
  resetField: resetFieldTool,
  generateOutline: generateOutlineTool,
};

/**
 * 导出工具名称类型（用于前端类型安全）
 */
export type InterviewToolName = keyof typeof interviewTools;

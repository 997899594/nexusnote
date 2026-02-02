/**
 * Interview Skills - 课程访谈相关 Tools
 *
 * AI SDK 6.x 风格：inputSchema + execute
 * 用于 /api/learn/interview 路由
 */

import { z } from 'zod'
import { tool } from 'ai'

/**
 * 更新用户画像 - 收集课程偏好
 */
export const updateProfile = tool({
  description: 'Update user profile/preferences for the course. Call when gathering difficulty, duration, depth preferences.',
  inputSchema: z.object({
    difficulty: z
      .enum(['beginner', 'intermediate', 'advanced'])
      .optional()
      .describe('Course difficulty level'),
    estimatedMinutes: z
      .number()
      .optional()
      .describe('Estimated learning time in minutes'),
    depth: z
      .enum(['shallow', 'normal', 'deep'])
      .optional()
      .describe('Content depth level'),
    language: z
      .string()
      .optional()
      .describe('Preferred language'),
    tone: z
      .string()
      .optional()
      .describe('Content tone/style'),
  }),
  execute: async (args) => {
    // 返回更新的字段，让前端 onToolCall 处理状态同步
    return {
      success: true,
      updated: args,
      message: 'Profile updated',
    }
  },
})

/**
 * 展示选项 - 让用户做选择
 */
export const presentOptions = tool({
  description: 'Present a list of options, slider, or confirmation to the user. Use for gathering user choices. STRONGLY PREFER single-dimension options over optionGroups.',
  inputSchema: z.object({
    type: z
      .enum(['options', 'slider', 'confirmation'])
      .describe('UI component type'),
    title: z
      .string()
      .describe('The question or title for the UI component. MUST address only ONE dimension.'),
    options: z
      .array(z.string())
      .optional()
      .describe('List of options for selection (for type=options). Use this for single-dimension choices.'),
    optionGroups: z
      .array(
        z.object({
          title: z.string().describe('Group title (e.g., "Difficulty", "Topic")'),
          options: z.array(z.string()).describe('Options in this group'),
        })
      )
      .optional()
      .describe('Grouped options for structured selection. AVOID using this unless absolutely necessary.'),
    sliderConfig: z
      .object({
        min: z.number(),
        max: z.number(),
        step: z.number(),
        unit: z.string(),
      })
      .optional()
      .describe('Slider configuration (for type=slider)'),
    multiSelect: z
      .boolean()
      .optional()
      .describe('Allow multiple selections'),
  }),
  execute: async (args) => {
    // 纯 UI 展示工具，返回参数供前端 Generative UI 渲染
    return {
      display: true,
      ...args,
    }
  },
})

/**
 * 更新大纲 - 生成或修改课程大纲
 */
export const updateOutline = tool({
  description: 'Update or generate the course outline. Call when you have enough info to create/modify the outline.',
  inputSchema: z.object({
    title: z.string().describe('Course title'),
    description: z.string().describe('Course description'),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    estimatedMinutes: z.number().describe('Total estimated time in minutes'),
    modules: z.array(
      z.object({
        title: z.string().describe('Module title'),
        chapters: z.array(
          z.object({
            title: z.string().describe('Chapter title'),
            contentSnippet: z
              .string()
              .optional()
              .describe('Brief content preview'),
          })
        ),
      })
    ),
    reason: z.string().describe('Reason for the update/generation'),
  }),
  execute: async (args) => {
    return {
      success: true,
      outline: {
        title: args.title,
        description: args.description,
        difficulty: args.difficulty,
        estimatedMinutes: args.estimatedMinutes,
        modules: args.modules,
      },
      reason: args.reason,
    }
  },
})

/**
 * 确认课程 - 完成访谈，开始生成
 */
export const confirmCourse = tool({
  description: 'Confirm the course outline and proceed to content generation. Call when user approves the outline.',
  inputSchema: z.object({
    finalOutlineTitle: z.string().describe('The confirmed course title'),
  }),
  execute: async ({ finalOutlineTitle }) => {
    return {
      confirmed: true,
      title: finalOutlineTitle,
      message: 'Course confirmed, proceeding to generation',
    }
  },
})

/**
 * 导出所有 interview tools
 */
export const interviewSkills = {
  updateProfile,
  presentOptions,
  updateOutline,
  confirmCourse,
}

export type InterviewSkillName = keyof typeof interviewSkills

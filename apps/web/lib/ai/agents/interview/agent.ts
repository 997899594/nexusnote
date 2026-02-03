import { streamText, tool, ModelMessage } from "ai";
import { registry } from "../../registry";
import { z } from "zod";

/**
 * Modern Interview Agent (2026) - Agentic Workflow
 *
 * 架构：
 * - ✅ streamText: 提供自然的流式对话体验
 * - ✅ Tools: 显式状态管理 (updateProfile) 和 终结技 (generateOutline)
 * - ✅ 解耦: 对话归对话，生成归生成
 *
 * 优势：
 * - 杜绝"早产": 只有调用 generateOutline 时才生成大纲
 * - 对话自然: 不受 JSON 结构限制，自由发挥
 * - 逻辑清晰: 状态更新显式化
 */

export interface InterviewContext {
  goal?: string;
  background?: string;
  time?: string;
  targetOutcome?: string;
  cognitiveStyle?: string;
}

/**
 * Build instructions for interview agent
 */
function buildInstructions(context: InterviewContext): string {
  const hasGoalFromURL = context.goal && !context.background && !context.time;

  const collected = {
    goal: context.goal
      ? hasGoalFromURL
        ? `⏳ 学习目标（待确认）: ${context.goal}`
        : `✓ 学习目标: ${context.goal}`
      : "✗ 学习目标（必需）",
    background: context.background
      ? `✓ 学习背景: ${context.background}`
      : "✗ 学习背景（必需）",
    time: context.time ? `✓ 可用时间: ${context.time}` : "✗ 可用时间（必需）",
  };

  const isComplete = context.goal && context.background && context.time;

  return `你是一位经验丰富、亲切热情的课程顾问。你的任务是通过自然的对话，帮助用户明确学习规划。

## 🎯 你的对话风格
1. **像人一样聊天**: 严禁使用机械的问答格式。使用口语化的表达。
2. **积极反馈**: 对用户的每一个回答都给予简短的肯定或评价。
3. **循循善诱**: 如果用户不知道怎么回答，给出一些常见的选项作为参考。
4. **一次只问一个问题**: 不要同时抛出多个问题，让对话保持轻松的节奏。

## 📋 必需信息（3项）
1. goal - 学习目标
2. background - 学习背景
3. time - 可用时间

## 📊 当前收集进度
${collected.goal}
${collected.background}
${collected.time}

## 🚀 你的行动指南

### 场景 1: 信息不完整（当前状态）
1. **优先**: 正常聊天，回应用户的话，建立信任。
2. **工具**: 如果用户在对话中提供了新的信息（goal/background/time），**立即调用 \`updateProfile\` 工具**。
   - 调用工具是无声的，用户看不见。
   - 调用工具后，继续你的回复。
3. **追问**: 确认已有的信息，自然地引出下一个缺失的信息。

### 场景 2: 信息完整（3项都有）
${isComplete ? `✅ 当前信息已完整！请执行：` : ""}
1. **回复**: "太好了！我已经完全了解你的需求了。基于你的情况，我为你量身定制了这份学习计划..."
2. **终结技**: **必须调用 \`generateOutline\` 工具**。
   - 这是生成大纲的唯一方式。
   - 调用此工具会触发前端跳转。

## ⚠️ 重要规则
- **始终使用中文回复**。
- **不要**在回复文本中直接输出 JSON。
- **不要**伪造工具调用，必须真实调用。`;
}

/**
 * Run Interview with Tools
 */
export async function runInterview(
  messages: ModelMessage[],
  context: InterviewContext = {},
) {
  const model = registry.chatModel;
  if (!model) throw new Error("AI model not configured");

  const result = streamText({
    model: model,
    messages: messages,
    system: buildInstructions(context),
    temperature: 0.7,
    // AI SDK 6.0.67 Standard: maxSteps is standard for server-side tool execution loops
    // It is NOT deprecated in streamText when using tools with server-side execution.
    // However, if using toolCall streaming without server execution, it's optional.
    // We keep it to allow the model to (1) call updateProfile -> (2) generate reply in one turn.
    maxSteps: 5,
    tools: {
      updateProfile: tool({
        description:
          "更新用户的学习档案信息。当从对话中识别到目标、背景或时间信息时调用。",
        inputSchema: z.object({
          goal: z
            .string()
            .optional()
            .describe("学习目标，如'Python编程'、'AI入门'"),
          background: z
            .string()
            .optional()
            .describe("学习背景，如'零基础'、'有编程经验'"),
          time: z
            .string()
            .optional()
            .describe("可用时间，如'每周5小时'、'全职学习'"),
        }),
        execute: async (args) => {
          // Server-side logic: Return success to let the model know it worked.
          // The frontend will also see this tool call and update local state.
          return { success: true, ...args };
        },
      }),

      presentOptions: tool({
        description:
          "向用户展示可点击的快捷回复选项。当你想提供建议回答时使用。",
        inputSchema: z.object({
          options: z
            .array(z.string())
            .describe("选项列表，如 ['零基础', '有经验', '专家']"),
        }),
        execute: async (args) => {
          return args; // 直接返回，前端会渲染
        },
      }),

      generateOutline: tool({
        description:
          "生成个性化课程大纲。仅在收集完所有必需信息（goal, background, time）后调用。",
        inputSchema: z.object({
          title: z.string().describe("课程标题"),
          description: z.string().describe("课程描述"),
          difficulty: z
            .enum(["beginner", "intermediate", "advanced"])
            .describe("难度级别"),
          estimatedMinutes: z.number().describe("预估学习时长（分钟）"),
          modules: z
            .array(
              z.object({
                title: z.string().describe("模块标题"),
                chapters: z.array(
                  z.object({
                    title: z.string().describe("章节标题"),
                    contentSnippet: z.string().optional().describe("章节简介"),
                  }),
                ),
              }),
            )
            .describe("课程模块列表"),
          reason: z
            .string()
            .describe("为什么这样设计课程结构？基于用户的背景和目标说明。"),
        }),
        execute: async (args) => {
          return { success: true, outline: args };
        },
      }),
    },
  });

  return result;
}

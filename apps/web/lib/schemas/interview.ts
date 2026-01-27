import { z } from "zod";

// 定义大纲节点的递归结构 (或者简化结构)
// 这是一个通用的课程大纲结构
const chapterSchema = z.object({
  title: z.string(),
  contentSnippet: z.string().optional(),
});

const moduleSchema = z.object({
  title: z.string(),
  chapters: z.array(chapterSchema),
});

export const interviewSchema = z.object({
  analysis: z
    .string()
    .describe(
      "【内心独白】如果是第一轮，分析用户的 goal 对应的学科属性（文/理/工/艺）。如果是后续轮次，分析用户的回答暗示了什么背景知识（Prior Knowledge）和性格（Cognitive Style）。推断潜在需求，并规划下一个提问策略。不要让用户看到这段内容。",
    ),
  feedback: z
    .string()
    .describe(
      "【确认与定调】一句话确认接收到的主题。语气冷静、客观。不要包含欢迎语或无关的修饰形容词。",
    ),
  nextQuestion: z
    .string()
    .optional()
    .describe(
      "【关键分流提问】基于专业知识，提出一个最具区分度的问题（通常是 技术栈分支 或 职业目标分支）。",
    ),
  isComplete: z.boolean().describe("是否已收集足够信息"),
  configUpdate: z
    .object({
      level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      levelDescription: z
        .string()
        .optional()
        .describe(
          "基于推理生成的对用户水平的自然语言描述，弥补 enum 的不足 (例如：'擅长后端逻辑，但对前端视觉还原有畏难情绪')",
        ),
      time: z.string().optional(),
      priorKnowledge: z.array(z.string()).optional(),
      targetOutcome: z.string().optional(),
      cognitiveStyle: z
        .enum(["conceptual", "action_oriented", "analogy_based"])
        .optional(),
    })
    .optional(),
  metaAction: z.enum(["continue", "correction", "finish"]).optional(),
  suggestedUI: z
    .object({
      type: z.enum(["options", "slider", "confirmation"]),
      title: z.string().optional(),
      options: z
        .array(z.string().max(20, "选项不能太长"))
        .min(2)
        .max(4)
        .optional()
        .describe(
          "预测用户最可能回答的3个短语，用第一人称，例如 '我只想快速上手'。必须基于当前对话语境动态生成。",
        ),
      sliderConfig: z
        .object({
          min: z.number(),
          max: z.number(),
          step: z.number(),
          unit: z.string(),
        })
        .optional(),
    })
    .optional(),
  // ✅ 新增：大纲修订字段
  revisedOutline: z
    .object({
      title: z.string(),
      modules: z.array(moduleSchema),
    })
    .optional()
    .describe("【仅在大纲修订模式下返回】根据用户反馈修改后的完整大纲结构。"),
});

export type InterviewSchema = z.infer<typeof interviewSchema>;

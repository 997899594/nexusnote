/**
 * Curriculum Designer Agent
 *
 * 职责：基于用户画像和领域研究设计个性化课程大纲
 *
 * 调用方式：Interview Agent 的 server-side tool（designCurriculum）
 * 模型：courseModel（更强的推理能力，用于大纲设计）
 */

import { z } from "zod";
import { registry } from "@/features/shared/ai/registry";
import type { TopicResearchOutput } from "@/features/learning/agents/research/agent";

/**
 * Curriculum Design 输入
 */
export const CurriculumDesignInputSchema = z.object({
  userProfile: z.object({
    goal: z.string(),
    background: z.string(),
    targetOutcome: z.string(),
    cognitiveStyle: z.string(),
  }),
  domainResearch: z.object({
    summary: z.string(),
    currentVersion: z.string().optional(),
    recentTrends: z.array(z.string()).optional(),
    typicalLearningPath: z.array(z.string()).optional(),
    prerequisites: z.array(z.string()).optional(),
    commonGoals: z.array(z.string()).optional(),
  }),
});

export type CurriculumDesignInput = z.infer<typeof CurriculumDesignInputSchema>;

/**
 * 课程大纲模块
 */
export const ModuleSchema = z.object({
  title: z.string().describe("模块标题"),
  topics: z.array(z.string()).describe("模块包含的主题"),
  estimatedMinutes: z.number().describe("预计学习时长（分钟）"),
});

/**
 * 课程大纲输出
 */
export const CurriculumOutputSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().describe("课程描述"),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]).describe("难度等级"),
  estimatedMinutes: z.number().describe("总预计学习时长"),
  designRationale: z.string().describe("设计理由：为什么这样安排模块"),
  modules: z.array(ModuleSchema).describe("课程模块列表"),
});

export type CurriculumOutput = z.infer<typeof CurriculumOutputSchema>;

const systemPrompt = `你是 NexusNote 的专业课程设计师。你的任务是基于用户画像和领域研究，设计一个高质量、个性化的学习大纲。

**设计原则：**
1. **个性化**：根据用户的背景和目标调整内容难度和深度
2. **实用性**：模块应该能直接应用到实际项目或工作场景
3. **循序渐进**：遵循领域研究的典型学习路径，但可根据用户前置知识跳过
4. **目标导向**：每个模块都应该对应用户的预期成果（如求职、项目部署）

**输出要求：**
- 课程标题：简洁、吸引人，反映内容特点
- 课程描述：1-2 句话说明课程价值
- 难度：beginner/intermediate/advanced
- 模块：5-10 个，每个模块 2-5 个主题
- 设计时长：基于模块数量和每个模块的时长计算
- 设计理由：解释为什么这样设计（基于用户画像 + 领域研究）

输出 JSON 格式，严格遵守 schema。`;

/**
 * 设计课程大纲
 *
 * 架构说明：
 * - 直接将结构化输入作为 prompt 的一部分传递给 AI
 * - AI SDK v6 的 generateText 支持在 prompt 中传递上下文对象
 * - 不需要手动拼接字符串，让 AI 自己解析结构化数据
 */
export async function designCurriculum(
  input: CurriculumDesignInput,
): Promise<CurriculumOutput> {
  const model = registry.courseModel ?? registry.chatModel;
  if (!model) {
    throw new Error("Course model not configured");
  }

  // 直接传递 JSON 格式的上下文，让 AI 解析
  const contextJSON = JSON.stringify(input, null, 2);

  const prompt = `基于以下用户画像和领域研究，设计个性化课程大纲：

${contextJSON}

请按照系统提示中的设计原则和输出要求生成课程大纲。`;

  // 使用 AI SDK v6 正确 API：generateText + Output.object
  const { generateText, Output } = await import("ai");

  const { output } = await generateText({
    model,
    system: systemPrompt,
    prompt,
    output: Output.object({
      schema: CurriculumOutputSchema,
    }),
  });

  return output;
}

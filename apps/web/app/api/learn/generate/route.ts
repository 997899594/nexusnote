import { generateObject } from "ai";
import { z } from "zod";
import {
  chatModel,
  webSearchModel,
  isAIConfigured,
  isWebSearchAvailable,
  getAIProviderInfo,
} from "@/lib/ai/registry";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

const CourseOutlineSchema = z.object({
  title: z.string(),
  description: z.string(),
  difficulty: z.enum(["beginner", "intermediate", "advanced"]),
  estimatedMinutes: z.number(),
  chapters: z.array(
    z.object({
      title: z.string(),
      summary: z.string(),
      keyPoints: z.array(z.string()),
    }),
  ),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { goal, level, time, priorKnowledge, targetOutcome, cognitiveStyle } =
    await req.json();

  if (!goal || typeof goal !== "string") {
    return Response.json({ error: "Missing learning goal" }, { status: 400 });
  }

  if (!isAIConfigured() || (!webSearchModel && !chatModel)) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    );
  }

  try {
    const model = (webSearchModel ?? chatModel)!;
    const useWebSearch = isWebSearchAvailable();

    const { object } = await generateObject({
      model,
      schema: CourseOutlineSchema,
      prompt: `你是一位全领域课程设计大师，擅长将任何复杂技能转化为结构化的学习路径。
${useWebSearch ? "你可以联网搜索最新资料，请确保内容是 2025-2026 年最新的。\n" : ""}

【用户认知画像】
- 学习主题：${goal}
- 现有水平：${level || "Beginner"}
- 时间预算：${time || "Flexible"}
- 目标成果：${targetOutcome || "General Knowledge"} (这是课程的北极星指标)
- 背景图谱 (Prior Knowledge)：${priorKnowledge?.join(", ") || "None"} (用于类比教学的锚点)
- 认知偏好 (Cognitive Style)：${cognitiveStyle || "action_oriented"} (决定内容的呈现逻辑)

【课程设计指令】
1. **类比教学 (Analogy-First)**：
   - 必须利用用户的 ${priorKnowledge?.join(", ")} 背景来解释 ${goal} 中的新概念。
   - *例如：如果是程序员学做菜，就把“备菜”类比为“初始化变量”。*
2. **目标倒推 (Outcome-Based)**：
   - 所有章节必须直接服务于 ${targetOutcome}。不要讲无关的废话。
3. **风格适配 (Cognitive Fit)**：
   - **Action-Oriented (行动型)**：每章必须有 SOP、步骤、Checklist 或实操练习。
   - **Conceptual (概念型)**：侧重原理、历史背景、底层逻辑推导。
   - **Analogy-Based (类比型)**：大量使用生活化比喻。

请生成一个符合 JSON Schema 的课程大纲。`,
      temperature: 0.8,
    });

    return Response.json(object);
  } catch (error) {
    console.error("[Learn Generate] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: `Course generation failed: ${message}` },
      { status: 500 },
    );
  }
}

import { generateText, Output } from "ai";
import { z } from "zod";
import { registry } from "../registry";

// Define the router output schema
export const RouterSchema = z.object({
  target: z
    .enum(["INTERVIEW", "CHAT", "SEARCH", "EDITOR"])
    .describe("The target agent to handle the user request."),
  reasoning: z.string().describe("Brief reasoning for the routing decision."),
  parameters: z
    .record(z.string(), z.any())
    .optional()
    .describe("Extracted parameters relevant to the target agent."),
});

export type RouterOutput = z.infer<typeof RouterSchema>;

/**
 * P1 Fast-Path: 语义路由预拦截
 * 针对极其明显的意图，直接返回结果，跳过 LLM 调用，降低延迟和成本。
 */
function fastRoute(input: string, contextStr?: string): RouterOutput | null {
  const normalizedInput = input.trim().toLowerCase();
  let context: any = {};
  try {
    if (contextStr) context = JSON.parse(contextStr);
  } catch (e) {}

  // 1. 明显的访谈启动意图
  const interviewKeywords = /想学|要学|学习|创建一个|课程|syllabus|learn|tutorial/i;
  if (interviewKeywords.test(normalizedInput) && normalizedInput.length < 50) {
    return {
      target: "INTERVIEW",
      reasoning: "Fast-path: Matched interview keywords.",
    };
  }

  // 2. 访谈延续意图 (基于 Context 的粘滞性)
  if (context.isInInterview) {
    // 如果已经在访谈中，且输入不包含明显的切换意图，则锁定在 INTERVIEW
    const switchIntentKeywords = /搜索|上网找|查找|修改|search|google|web|edit|change/i;
    if (
      !switchIntentKeywords.test(normalizedInput) &&
      normalizedInput.length < 100
    ) {
      return {
        target: "INTERVIEW",
        reasoning: "Fast-path: Context stickiness (isInInterview).",
      };
    }
  }

  // 3. 基础聊天意图
  const chatKeywords = /^(你好|hello|hi|你是谁|who are you|早安|午安|晚安)[！!？?.]*$/i;
  if (chatKeywords.test(normalizedInput)) {
    return {
      target: "CHAT",
      reasoning: "Fast-path: Casual greeting.",
    };
  }

  return null;
}

export async function routeIntent(
  input: string,
  context?: string,
): Promise<RouterOutput> {
  // 0. P1 Fast-Path: 预拦截逻辑
  const fastResult = fastRoute(input, context);
  if (fastResult) {
    return fastResult;
  }

  // 1. LLM 语义分类 (Slow-Path)
  // Use the fast model for routing (low latency is key)
  const model = registry.fastModel;

  if (!model) {
    throw new Error("No AI model configured for routing.");
  }

  const result = await generateText({
    model,
    temperature: 0, // 🧊 绝对零度，确保分类稳定
    experimental_output: Output.object({ schema: RouterSchema }),
    system: `
      You are the Central Router for NexusNote, an AI course generator and learning assistant.
      Your job is to CLASSIFY user intent into one of four categories:

      1. **INTERVIEW**: 
         - User wants to create a new course/syllabus.
         - User is answering questions related to course creation (goals, background, time).
         - Keywords: "create course", "learn python", "syllabus", "beginner", "2 hours a week".
      
      2. **CHAT**:
         - User is asking general questions, coding help, or casual conversation.
         - User is asking about existing content (RAG).
         - Keywords: "how does react work?", "explain this code", "hello".

      3. **SEARCH**:
         - User explicitly asks to search the web or asks for real-time info.
         - Keywords: "search for", "latest news", "current weather".
      
      4. **EDITOR**:
         - User wants to modify the generated outline or document.
         - Keywords: "change chapter 1", "add a section", "rewrite this".

      **Context Awareness**:
      If 'context' is provided, use it to inform your decision. For example, if the user is in the middle of an interview (state: ASK_GOAL), even a short answer like "Python" should be routed to INTERVIEW.
    `,
    prompt: `
      Context: ${context || "None"}
      User Input: "${input}"
    `,
  });

  return result.experimental_output;
}

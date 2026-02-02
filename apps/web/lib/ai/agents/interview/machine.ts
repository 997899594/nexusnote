import { streamText, generateText, Output, tool } from "ai";
import { registry } from "../../registry";
import {
  InterviewState,
  OptionsResponseSchema,
  ConfirmationResponseSchema,
  UIResponseSchema,
  InterviewContext,
} from "./schema";
import { z } from "zod";

type StepResult = {
  nextState: InterviewState;
  contextUpdates: Partial<InterviewContext>;
  stream: Response; // AI Stream Response
};

export type { InterviewContext };

export async function runInterviewStep(
  state: InterviewState,
  input: string,
  context: InterviewContext = {},
): Promise<StepResult> {
  const model = registry.chatModel;
  const fastModel = registry.fastModel || registry.chatModel;

  if (!model) throw new Error("AI model not configured");
  if (!fastModel) throw new Error("Fast AI model not configured");

  let nextState: InterviewState = state;
  let contextUpdates: Partial<InterviewContext> = {};
  let systemPrompt = "";
  let prompt = "";

  // =========================================================
  // STATE MACHINE LOGIC
  // =========================================================

  // Base System Prompt
  const BASE_SYSTEM_PROMPT = `你是一位专业的课程顾问。你的目标是热情地开始访谈，帮助用户明确学习目标、背景和时间安排。请始终用中文回复。`;

  // Handle Input & Transition (Pre-processing)
  if (state === "IDLE") {
    // Check if input already contains a goal
    const extraction = await generateText({
      model: fastModel,
      temperature: 0,
      experimental_output: Output.object({
        schema: z.object({
          hasGoal: z.boolean(),
          goal: z.string().optional(),
        }),
      }),
      prompt: `Analyze the user input to check if it contains a learning goal or topic.
               User Input: "${input}"
               
               Task:
               1. If the input states a goal (e.g. "I want to learn Python", "teach me AI", "我的目标是：AI", "想学吉他"), set hasGoal=true and extract the core topic into 'goal'.
               2. If the input is just a greeting or vague (e.g. "start", "hello", "interview me", "你好"), set hasGoal=false.
               
               Note: The user input might be explicitly formatted like "我的目标是：XXX". This definitely counts as hasGoal=true.`,
    });

    if (
      extraction.experimental_output.hasGoal &&
      extraction.experimental_output.goal
    ) {
      contextUpdates.goal = extraction.experimental_output.goal;
      nextState = "ASK_BACKGROUND";
    } else {
      nextState = "ASK_GOAL";
    }
  } else if (state === "ASK_GOAL") {
    // User provided goal
    // Extract Goal
    const extraction = await generateText({
      model: fastModel,
      temperature: 0, // Logic extraction should be precise
      experimental_output: Output.object({
        schema: z.object({ goal: z.string() }),
      }),
      prompt: `Extract the learning goal from this user input: "${input}". If vague, summarize it.`,
    });
    contextUpdates.goal = extraction.experimental_output.goal;
    nextState = "ASK_BACKGROUND";
  } else if (state === "ASK_BACKGROUND") {
    // User provided background
    contextUpdates.background = input;
    nextState = "ASK_TIME";
  } else if (state === "ASK_TIME") {
    // User provided time
    contextUpdates.time = input;
    nextState = "CONFIRM";
  } else if (state === "CONFIRM") {
    // User confirmed
    nextState = "GENERATING";
  }

  // Generate Response for Next State (Post-processing)
  const currentContext = { ...context, ...contextUpdates };

  switch (nextState) {
    case "ASK_GOAL":
      systemPrompt = BASE_SYSTEM_PROMPT;
      prompt = `向用户问好，并询问他们想学习什么。保持简洁专业。`;
      break;

    case "ASK_BACKGROUND":
      systemPrompt = `${BASE_SYSTEM_PROMPT}\n用户想学习："${currentContext.goal}"。`;
      prompt = `
        1. 确认用户的目标 (${currentContext.goal})。
        2. 询问他们在这个领域目前的经验水平或背景。
        3. 必须调用 'presentOptions' 工具来提供 3-4 个不同的背景选项供用户选择（例如：完全零基础、有一些经验、专业人士）。
      `;
      break;

    case "ASK_TIME":
      systemPrompt = `${BASE_SYSTEM_PROMPT}
        用户目标: ${currentContext.goal}
        用户背景: ${currentContext.background}
      `;
      prompt = `
        1. 确认他们的背景。
        2. 询问他们每周能投入多少时间学习。
        3. 必须调用 'presentOptions' 工具来提供 3-4 个选项（例如：每周2小时、每周5-10小时、全职学习）。
      `;
      break;

    case "CONFIRM":
      systemPrompt = `${BASE_SYSTEM_PROMPT}
        用户目标: ${currentContext.goal}
        用户背景: ${currentContext.background}
        用户时间: ${currentContext.time}
      `;
      prompt = `
        1. 总结收集到的信息。
        2. 询问是否确认开始生成课程。
      `;
      break;

    case "GENERATING":
      systemPrompt = `${BASE_SYSTEM_PROMPT}\n用户已确认。`;
      prompt = `告诉用户你正在根据他们的偏好开始生成课程。`;
      break;

    default:
      // Should not happen, but fallback
      systemPrompt = BASE_SYSTEM_PROMPT;
      prompt = input;
      break;
  }

  // Call AI with streamText + Tools (Hybrid Mode: Text Stream + Tool Data)
  const result = streamText({
    model: model,
    temperature: 0.2,
    system: systemPrompt,
    prompt:
      prompt +
      "\n\nIMPORTANT: If you need to present options to the user, call the 'presentOptions' tool. Do NOT output JSON in the text response.",
    tools: {
      presentOptions: tool({
        description: "Present a list of choice options to the user.",
        parameters: z.object({
          options: z
            .array(z.string())
            .describe("The list of options to display"),
        }),
        execute: async ({ options }) => {
          return { options };
        },
      }),
    },
  });

  return {
    nextState,
    contextUpdates,
    stream: result.toTextStreamResponse(),
  };
}

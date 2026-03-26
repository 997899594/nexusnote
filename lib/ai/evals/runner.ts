import { convertToModelMessages, generateText, readUIMessageStream, type UIMessage } from "ai";
import { createInterviewAgent } from "@/lib/ai/agents";
import { createChatAgent } from "@/lib/ai/agents/chat";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { buildPromptInstructions } from "@/lib/ai/core/prompt-registry";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import {
  findLatestOutline,
  getInterviewMessageOptions,
  getInterviewMessageText,
  type InterviewUIMessage,
} from "@/lib/ai/interview";
import { judgeEvalOutput } from "./judge";
import type {
  ChatEvalInput,
  EvalCase,
  EvalExecutionResult,
  EvalSuite,
  EvalSuiteRunResult,
  InterviewEvalInput,
  LearnEvalInput,
  NotesEvalInput,
} from "./types";

export function createEvalSuite<TInput>(suite: EvalSuite<TInput>): EvalSuite<TInput> {
  return suite;
}

const EVAL_AGENT_TIMEOUT_MS = 45_000;

async function buildEvalGenerationInput(testCase: EvalCase): Promise<
  | {
      mode: "agent-chat";
      prompt: string;
    }
  | {
      mode: "agent-notes";
      prompt: string;
      noteExcerpt: string;
    }
  | {
      mode: "agent-interview";
      prompt: string;
      currentOutline?: InterviewEvalInput["currentOutline"];
    }
  | {
      mode: "text";
      prompt: string;
      instructions: string;
    }
> {
  switch (testCase.domain) {
    case "chat": {
      const input = testCase.input as unknown as ChatEvalInput;
      return {
        mode: "agent-chat",
        prompt: input.message,
      };
    }
    case "interview": {
      const input = testCase.input as unknown as InterviewEvalInput;
      return {
        mode: "agent-interview",
        prompt: input.userGoal,
        currentOutline: input.currentOutline,
      };
    }
    case "learn": {
      const input = testCase.input as unknown as LearnEvalInput;
      return {
        mode: "text",
        instructions: buildPromptInstructions("learn-assist@v1", {
          userContext: `## 当前课程上下文\n${input.courseContext}`,
        }),
        prompt: input.question,
      };
    }
    case "notes": {
      const input = testCase.input as unknown as NotesEvalInput;
      return {
        mode: "agent-notes",
        prompt: input.instruction,
        noteExcerpt: input.noteExcerpt,
      };
    }
    default:
      throw new Error(`Unsupported eval domain: ${testCase.domain satisfies never}`);
  }
}

function getPolicyForCase(testCase: EvalCase) {
  switch (testCase.domain) {
    case "chat":
    case "interview":
    case "learn":
    case "notes":
      return "interactive-fast" as const;
    default:
      throw new Error(`Unsupported eval domain: ${testCase.domain satisfies never}`);
  }
}

export async function runEvalCase(testCase: EvalCase): Promise<EvalExecutionResult> {
  try {
    const startedAt = Date.now();
    const generationInput = await buildEvalGenerationInput(testCase);
    const modelPolicy = getPolicyForCase(testCase);
    const telemetry = createTelemetryContext({
      endpoint: "eval:generate",
      workflow: "ai-eval-generate",
      promptVersion: testCase.promptVersion,
      modelPolicy,
      metadata: {
        caseId: testCase.id,
        domain: testCase.domain,
      },
    });

    let serializedOutput: string;
    if (generationInput.mode === "agent-chat") {
      serializedOutput = await runChatEval({
        prompt: generationInput.prompt,
        profile: "CHAT_BASIC",
        telemetry,
        startedAt,
      });
    } else if (generationInput.mode === "agent-notes") {
      serializedOutput = await runChatEval({
        prompt: generationInput.prompt,
        profile: "NOTE_ASSIST",
        userContext: `## 当前笔记内容\n${generationInput.noteExcerpt}`,
        telemetry,
        startedAt,
      });
    } else if (generationInput.mode === "agent-interview") {
      serializedOutput = await runInterviewEval({
        prompt: generationInput.prompt,
        currentOutline: generationInput.currentOutline,
        telemetry,
        startedAt,
      });
    } else {
      serializedOutput = await runTextEval({
        instructions: generationInput.instructions,
        prompt: generationInput.prompt,
        modelPolicy,
        telemetry,
        startedAt,
      });
    }
    const judgement = await judgeEvalOutput(testCase, serializedOutput);

    return {
      caseId: testCase.id,
      title: testCase.title,
      score: judgement.score,
      passed: judgement.score >= 0.8,
      notes: judgement.notes,
      output: serializedOutput,
    };
  } catch (error) {
    return {
      caseId: testCase.id,
      title: testCase.title,
      score: 0,
      passed: false,
      notes: [`Eval execution failed: ${getErrorMessage(error)}`],
      output: "",
    };
  }
}

async function runTextEval({
  instructions,
  prompt,
  modelPolicy,
  telemetry,
  startedAt,
}: {
  instructions: string;
  prompt: string;
  modelPolicy: ReturnType<typeof getPolicyForCase>;
  telemetry: ReturnType<typeof createTelemetryContext>;
  startedAt: number;
}) {
  const generated = await generateText({
    model: getModelForPolicy(modelPolicy),
    system: instructions,
    prompt,
    temperature: 0.2,
    timeout: 30_000,
  });

  await recordAIUsage({
    ...telemetry,
    usage: generated.usage,
    durationMs: Date.now() - startedAt,
    success: true,
  });

  return generated.text;
}

async function runChatEval({
  prompt,
  profile,
  userContext,
  telemetry,
  startedAt,
}: {
  prompt: string;
  profile: "CHAT_BASIC" | "NOTE_ASSIST";
  userContext?: string;
  telemetry: ReturnType<typeof createTelemetryContext>;
  startedAt: number;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("eval-timeout"), EVAL_AGENT_TIMEOUT_MS);
  try {
    const messages = [
      {
        id: `eval-user-${crypto.randomUUID()}`,
        role: "user" as const,
        parts: [{ type: "text" as const, text: prompt }],
      },
    ];

    const agent = await createChatAgent({
      userId: "eval-user",
      profile,
      userContext,
      telemetry,
    });

    const modelMessages = await convertToModelMessages(messages, {
      tools: agent.tools,
    });

    const result = await agent.stream({
      prompt: modelMessages,
      abortSignal: controller.signal,
    });

    const latestById = new Map<string, UIMessage>();
    for await (const uiMessage of readUIMessageStream<UIMessage>({
      stream: result.toUIMessageStream({
        originalMessages: messages,
        sendReasoning: false,
      }),
    })) {
      latestById.set(uiMessage.id, uiMessage);
    }

    const finalMessages = [...latestById.values()];
    const lastAssistant = [...finalMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    const text =
      lastAssistant?.parts
        ?.filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
        .trim() ?? "";

    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: true,
      metadata: {
        ...telemetry.metadata,
        mode: profile === "NOTE_ASSIST" ? "agent-notes" : "agent-chat",
      },
    });

    return text;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function runInterviewEval({
  prompt,
  currentOutline,
  telemetry,
  startedAt,
}: {
  prompt: string;
  currentOutline?: InterviewEvalInput["currentOutline"];
  telemetry: ReturnType<typeof createTelemetryContext>;
  startedAt: number;
}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("eval-timeout"), EVAL_AGENT_TIMEOUT_MS);
  try {
    const messages: InterviewUIMessage[] = [
      {
        id: `eval-user-${crypto.randomUUID()}`,
        role: "user",
        parts: [{ type: "text", text: prompt }],
      },
    ];

    const agent = createInterviewAgent({
      userId: "eval-user",
      currentOutline,
      messages,
      telemetry,
    });

    const modelMessages = await convertToModelMessages(messages, {
      tools: agent.tools,
    });

    const result = await agent.stream({
      prompt: modelMessages,
      abortSignal: controller.signal,
    });

    const latestById = new Map<string, InterviewUIMessage>();
    for await (const uiMessage of readUIMessageStream<InterviewUIMessage>({
      stream: result.toUIMessageStream<InterviewUIMessage>({
        originalMessages: messages,
        sendReasoning: false,
      }),
      terminateOnError: true,
    })) {
      latestById.set(uiMessage.id, uiMessage);
    }

    const finalMessages = [...latestById.values()];
    const lastAssistant = [...finalMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    const latestOutline = findLatestOutline(finalMessages);

    const text = lastAssistant ? getInterviewMessageText(lastAssistant) : "";
    const options = lastAssistant ? getInterviewMessageOptions(lastAssistant) : [];

    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: true,
      metadata: {
        ...telemetry.metadata,
        mode: "agent-interview",
      },
    });

    return JSON.stringify(
      {
        message: text,
        options,
        outline: latestOutline?.outline ?? null,
        courseId: null,
      },
      null,
      2,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runEvalSuite<TInput>(suite: EvalSuite<TInput>): Promise<EvalSuiteRunResult> {
  const results: EvalExecutionResult[] = [];

  for (const testCase of suite.cases) {
    results.push(await runEvalCase(testCase as EvalCase<Record<string, unknown>>));
  }

  const totalScore = results.reduce((sum, result) => sum + result.score, 0);
  const passedCount = results.filter((result) => result.passed).length;

  return {
    domain: suite.domain,
    version: suite.version,
    averageScore: results.length > 0 ? totalScore / results.length : 0,
    passedCount,
    totalCount: results.length,
    results,
  };
}

export function summarizeEvalSuite<TInput>(suite: EvalSuite<TInput>) {
  return {
    domain: suite.domain,
    version: suite.version,
    caseCount: suite.cases.length,
    caseIds: suite.cases.map((testCase) => testCase.id),
  };
}

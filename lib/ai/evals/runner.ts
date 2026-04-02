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
  EvalRegressionSpec,
  EvalRuleCheck,
  EvalRuntimeMetrics,
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
const EVAL_TEXT_TIMEOUT_MS = 45_000;

interface EvalGenerationResult {
  output: string;
  runtimeMetrics: EvalRuntimeMetrics;
}

interface RunEvalSuiteOptions {
  onCaseComplete?: (result: EvalExecutionResult) => void;
}

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

function isTimeoutError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("eval-timeout") ||
    message.includes("aborted") ||
    message.includes("aborterror") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function parseJsonOutput(output: string) {
  try {
    return JSON.parse(output) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function runInterviewRuleChecks(output: string): EvalRuleCheck[] {
  const parsed = parseJsonOutput(output);

  if (!parsed) {
    return [
      {
        name: "valid-json-output",
        passed: false,
        details: "Interview eval output is not valid JSON.",
      },
    ];
  }

  const outline = parsed.outline;
  const message = typeof parsed.message === "string" ? parsed.message.trim() : "";
  const options = Array.isArray(parsed.options)
    ? parsed.options.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const courseId = parsed.courseId;

  const checks: EvalRuleCheck[] = [
    {
      name: "assistant-message-present",
      passed: message.length > 0,
      details:
        message.length > 0
          ? "Assistant returned a non-empty message."
          : "Assistant message is empty.",
    },
    {
      name: "options-count",
      passed: options.length >= 2 && options.length <= 4,
      details: `Options count is ${options.length}. Expected 2-4.`,
    },
    {
      name: "preview-course-id-empty",
      passed: courseId == null,
      details:
        courseId == null
          ? "Preview output does not persist a course id."
          : `Preview unexpectedly returned courseId=${String(courseId)}.`,
    },
  ];

  if (!outline || typeof outline !== "object") {
    checks.push({
      name: "outline-shape",
      passed: true,
      details: "No outline returned in this turn.",
    });
    return checks;
  }

  const outlineRecord = outline as Record<string, unknown>;
  const chapters = Array.isArray(outlineRecord.chapters)
    ? outlineRecord.chapters.filter(
        (chapter): chapter is Record<string, unknown> => !!chapter && typeof chapter === "object",
      )
    : [];

  checks.push(
    {
      name: "outline-metadata",
      passed:
        typeof outlineRecord.title === "string" &&
        outlineRecord.title.trim().length > 0 &&
        typeof outlineRecord.description === "string" &&
        outlineRecord.description.trim().length > 0 &&
        typeof outlineRecord.targetAudience === "string" &&
        outlineRecord.targetAudience.trim().length > 0 &&
        typeof outlineRecord.learningOutcome === "string" &&
        outlineRecord.learningOutcome.trim().length > 0,
      details:
        "Outline preview must contain title, description, targetAudience, and learningOutcome.",
    },
    {
      name: "chapter-count",
      passed: chapters.length >= 5 && chapters.length <= 7,
      details: `Outline chapter count is ${chapters.length}. Expected 5-7.`,
    },
    {
      name: "course-skill-ids",
      passed:
        Array.isArray(outlineRecord.courseSkillIds) &&
        outlineRecord.courseSkillIds.length >= 1 &&
        outlineRecord.courseSkillIds.length <= 6 &&
        outlineRecord.courseSkillIds.every(
          (skillId) => typeof skillId === "string" && skillId.trim().length > 0,
        ),
      details: "Outline preview must contain 1-6 non-empty courseSkillIds.",
    },
  );

  const invalidChapterIndexes: number[] = [];
  const invalidChapterSkillIndexes: number[] = [];
  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const sections = Array.isArray(chapter.sections)
      ? chapter.sections.filter(
          (section): section is Record<string, unknown> => !!section && typeof section === "object",
        )
      : [];
    if (sections.length < 4 || sections.length > 6) {
      invalidChapterIndexes.push(i + 1);
    }

    const skillIds = Array.isArray(chapter.skillIds) ? chapter.skillIds : [];
    const hasValidSkillIds =
      skillIds.length >= 1 &&
      skillIds.length <= 4 &&
      skillIds.every((skillId) => typeof skillId === "string" && skillId.trim().length > 0);

    if (!hasValidSkillIds) {
      invalidChapterSkillIndexes.push(i + 1);
    }
  }

  checks.push({
    name: "sections-per-chapter",
    passed: invalidChapterIndexes.length === 0,
    details:
      invalidChapterIndexes.length === 0
        ? "All chapters contain 4-6 sections."
        : `Chapters with invalid section counts: ${invalidChapterIndexes.join(", ")}.`,
  });

  checks.push({
    name: "chapter-skill-ids",
    passed: invalidChapterSkillIndexes.length === 0,
    details:
      invalidChapterSkillIndexes.length === 0
        ? "All chapters contain 1-4 skillIds."
        : `Chapters with invalid skillIds: ${invalidChapterSkillIndexes.join(", ")}.`,
  });

  return checks;
}

function includesText(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("zh-CN").includes(needle.toLocaleLowerCase("zh-CN"));
}

function runRegressionSpecChecks(
  regression: EvalRegressionSpec | undefined,
  output: string,
): EvalRuleCheck[] {
  if (!regression) {
    return [];
  }

  const trimmedOutput = output.trim();
  const checks: EvalRuleCheck[] = [];

  if (regression.minOutputLength != null) {
    checks.push({
      name: "min-output-length",
      passed: trimmedOutput.length >= regression.minOutputLength,
      details: `Output length is ${trimmedOutput.length}. Expected >= ${regression.minOutputLength}.`,
    });
  }

  for (const requiredSubstring of regression.requiredSubstrings ?? []) {
    checks.push({
      name: `required:${requiredSubstring}`,
      passed: includesText(trimmedOutput, requiredSubstring),
      details: includesText(trimmedOutput, requiredSubstring)
        ? `Output contains required text "${requiredSubstring}".`
        : `Output is missing required text "${requiredSubstring}".`,
    });
  }

  for (const forbiddenSubstring of regression.forbiddenSubstrings ?? []) {
    checks.push({
      name: `forbidden:${forbiddenSubstring}`,
      passed: !includesText(trimmedOutput, forbiddenSubstring),
      details: includesText(trimmedOutput, forbiddenSubstring)
        ? `Output unexpectedly contains forbidden text "${forbiddenSubstring}".`
        : `Output does not contain forbidden text "${forbiddenSubstring}".`,
    });
  }

  for (const forbiddenPattern of regression.forbiddenPatterns ?? []) {
    const matched = new RegExp(forbiddenPattern, "iu").test(trimmedOutput);
    checks.push({
      name: `forbidden-pattern:${forbiddenPattern}`,
      passed: !matched,
      details: matched
        ? `Output unexpectedly matches forbidden pattern /${forbiddenPattern}/iu.`
        : `Output does not match forbidden pattern /${forbiddenPattern}/iu.`,
    });
  }

  return checks;
}

function runDomainRuleChecks(testCase: EvalCase, output: string): EvalRuleCheck[] {
  switch (testCase.domain) {
    case "interview":
      return runInterviewRuleChecks(output);
    default:
      return [];
  }
}

function runRuleChecks(testCase: EvalCase, output: string): EvalRuleCheck[] {
  return [
    ...runDomainRuleChecks(testCase, output),
    ...runRegressionSpecChecks(testCase.regression, output),
  ];
}

export async function runEvalCase(testCase: EvalCase): Promise<EvalExecutionResult> {
  const startedAt = Date.now();

  try {
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

    let generationResult: EvalGenerationResult;
    if (generationInput.mode === "agent-chat") {
      generationResult = await runChatEval({
        prompt: generationInput.prompt,
        profile: "CHAT_BASIC",
        telemetry,
        startedAt,
      });
    } else if (generationInput.mode === "agent-notes") {
      generationResult = await runChatEval({
        prompt: generationInput.prompt,
        profile: "NOTE_ASSIST",
        userContext: `## 当前笔记内容\n${generationInput.noteExcerpt}`,
        telemetry,
        startedAt,
      });
    } else if (generationInput.mode === "agent-interview") {
      generationResult = await runInterviewEval({
        prompt: generationInput.prompt,
        currentOutline: generationInput.currentOutline,
        telemetry,
        startedAt,
      });
    } else {
      generationResult = await runTextEval({
        instructions: generationInput.instructions,
        prompt: generationInput.prompt,
        modelPolicy,
        telemetry,
        startedAt,
      });
    }

    const ruleChecks = runRuleChecks(testCase, generationResult.output);
    const judgement = await judgeEvalOutput(testCase, generationResult.output);
    const deterministicPassed = ruleChecks.every((check) => check.passed);

    return {
      caseId: testCase.id,
      title: testCase.title,
      score: judgement.score,
      passed: judgement.score >= 0.8 && deterministicPassed,
      notes: judgement.notes,
      output: generationResult.output,
      ruleChecks,
      runtimeMetrics: generationResult.runtimeMetrics,
    };
  } catch (error) {
    return {
      caseId: testCase.id,
      title: testCase.title,
      score: 0,
      passed: false,
      notes: [`Eval execution failed: ${getErrorMessage(error)}`],
      output: "",
      ruleChecks: [],
      runtimeMetrics: {
        totalMs: Date.now() - startedAt,
        timedOut: isTimeoutError(error),
      },
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
}): Promise<EvalGenerationResult> {
  const generated = await generateText({
    model: getModelForPolicy(modelPolicy),
    system: instructions,
    prompt,
    temperature: 0.2,
    timeout: EVAL_TEXT_TIMEOUT_MS,
  });

  const totalMs = Date.now() - startedAt;

  await recordAIUsage({
    ...telemetry,
    usage: generated.usage,
    durationMs: totalMs,
    success: true,
  });

  return {
    output: generated.text,
    runtimeMetrics: {
      totalMs,
      firstTextMs: totalMs,
      firstOptionsMs: null,
      firstOutlineMs: null,
      timedOut: false,
    },
  };
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
}): Promise<EvalGenerationResult> {
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
    let firstTextMs: number | null = null;

    for await (const uiMessage of readUIMessageStream<UIMessage>({
      stream: result.toUIMessageStream({
        originalMessages: messages,
        sendReasoning: false,
      }),
    })) {
      latestById.set(uiMessage.id, uiMessage);

      if (firstTextMs == null && uiMessage.role === "assistant") {
        const text = uiMessage.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("")
          .trim();

        if (text.length > 0) {
          firstTextMs = Date.now() - startedAt;
        }
      }
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

    const totalMs = Date.now() - startedAt;

    await recordAIUsage({
      ...telemetry,
      durationMs: totalMs,
      success: true,
      metadata: {
        ...telemetry.metadata,
        mode: profile === "NOTE_ASSIST" ? "agent-notes" : "agent-chat",
      },
    });

    return {
      output: text,
      runtimeMetrics: {
        totalMs,
        firstTextMs,
        firstOptionsMs: null,
        firstOutlineMs: null,
        timedOut: false,
      },
    };
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
}): Promise<EvalGenerationResult> {
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
    let firstTextMs: number | null = null;
    let firstOptionsMs: number | null = null;
    let firstOutlineMs: number | null = null;

    for await (const uiMessage of readUIMessageStream<InterviewUIMessage>({
      stream: result.toUIMessageStream<InterviewUIMessage>({
        originalMessages: messages,
        sendReasoning: false,
      }),
      terminateOnError: true,
    })) {
      latestById.set(uiMessage.id, uiMessage);

      if (uiMessage.role !== "assistant") {
        continue;
      }

      if (firstTextMs == null && getInterviewMessageText(uiMessage).length > 0) {
        firstTextMs = Date.now() - startedAt;
      }

      if (firstOptionsMs == null && getInterviewMessageOptions(uiMessage).length > 0) {
        firstOptionsMs = Date.now() - startedAt;
      }

      if (firstOutlineMs == null) {
        const outline = findLatestOutline([uiMessage]);
        if (outline) {
          firstOutlineMs = Date.now() - startedAt;
        }
      }
    }

    const finalMessages = [...latestById.values()];
    const lastAssistant = [...finalMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    const latestOutline = findLatestOutline(finalMessages);

    const text = lastAssistant ? getInterviewMessageText(lastAssistant) : "";
    const options = lastAssistant ? getInterviewMessageOptions(lastAssistant) : [];
    const totalMs = Date.now() - startedAt;

    await recordAIUsage({
      ...telemetry,
      durationMs: totalMs,
      success: true,
      metadata: {
        ...telemetry.metadata,
        mode: "agent-interview",
      },
    });

    return {
      output: JSON.stringify(
        {
          message: text,
          options,
          outline: latestOutline?.outline ?? null,
          courseId: null,
        },
        null,
        2,
      ),
      runtimeMetrics: {
        totalMs,
        firstTextMs,
        firstOptionsMs,
        firstOutlineMs,
        timedOut: false,
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function runEvalSuite<TInput>(
  suite: EvalSuite<TInput>,
  options?: RunEvalSuiteOptions,
): Promise<EvalSuiteRunResult> {
  const results: EvalExecutionResult[] = [];

  for (const testCase of suite.cases) {
    const result = await runEvalCase(testCase as EvalCase<Record<string, unknown>>);
    results.push(result);
    options?.onCaseComplete?.(result);
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

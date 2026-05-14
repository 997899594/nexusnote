import { convertToModelMessages, generateText, readUIMessageStream, type UIMessage } from "ai";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { buildPromptInstructions } from "@/lib/ai/core/prompt-registry";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import {
  INTERVIEW_OUTLINE_CHAPTER_LIMITS,
  INTERVIEW_OUTLINE_SECTION_LIMITS,
} from "@/lib/ai/interview/schemas";
import {
  findLatestOutline,
  findLatestStableOutline,
  getInterviewMessageOptions,
  getInterviewMessageText,
  getLatestVisibleInterviewAssistantMessage,
  type InterviewUIMessage,
} from "@/lib/ai/interview/ui";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { routeDecisionSchema } from "@/lib/ai/routing/schemas";
import {
  createConversationSpecialistAgent,
  createCourseInterviewerSpecialistAgent,
} from "@/lib/ai/specialists/registry";
import { buildCareerDevelopmentGraph } from "@/lib/career-tree/career-development-graph";
import { judgeEvalOutput } from "./judge";
import type {
  CareerTreeEvalInput,
  ChatEvalInput,
  EvalCase,
  EvalContractAssessment,
  EvalExecutionResult,
  EvalQualityAssessment,
  EvalRegressionSpec,
  EvalRuleCheck,
  EvalRuntimeMetrics,
  EvalSuite,
  EvalSuiteRunResult,
  InterviewEvalInput,
  LearnEvalInput,
  NotesEvalInput,
  RoutingEvalInput,
} from "./types";

export function createEvalSuite<TInput>(suite: EvalSuite<TInput>): EvalSuite<TInput> {
  return suite;
}

const EVAL_AGENT_TIMEOUT_MS = 45_000;
const EVAL_TEXT_TIMEOUT_MS = 45_000;
const EVAL_RECORD_USAGE = false;

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
      messages?: InterviewEvalInput["messages"];
      currentOutline?: InterviewEvalInput["currentOutline"];
    }
  | {
      mode: "text";
      prompt: string;
      instructions: string;
    }
  | {
      mode: "routing";
      prompt: string;
      requestContext: RoutingEvalInput["requestContext"];
    }
  | {
      mode: "career-tree-graph";
      snapshot: CareerTreeEvalInput["snapshot"];
      directionKey?: string | null;
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
        messages: input.messages,
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
    case "routing": {
      const input = testCase.input as unknown as RoutingEvalInput;
      return {
        mode: "routing",
        prompt: input.message,
        requestContext: input.requestContext,
      };
    }
    case "career-tree": {
      const input = testCase.input as unknown as CareerTreeEvalInput;
      return {
        mode: "career-tree-graph",
        snapshot: input.snapshot,
        directionKey: input.directionKey,
      };
    }
    default:
      throw new Error(`Unsupported eval domain: ${testCase.domain satisfies never}`);
  }
}

function getPolicyForCase(testCase: EvalCase) {
  switch (testCase.domain) {
    case "chat":
    case "learn":
    case "notes":
      return "interactive-fast" as const;
    case "interview": {
      return "interactive-fast" as const;
    }
    case "routing":
    case "career-tree":
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

function isGenericCourseTitle(title: string) {
  const normalized = title.trim();
  if (normalized.length < 6) {
    return true;
  }

  const hasPathOrOutcomeSignal = /[：:：]|从.+到|实战|项目|作品|转型|交付|应用|冲刺|备考|进阶/.test(
    normalized,
  );
  const endsWithGenericCourseType = /(概念课|基础课|入门课|系统课|系统学习|系统讲解)$/.test(
    normalized,
  );

  return endsWithGenericCourseType && !hasPathOrOutcomeSignal;
}

function hasConcreteOutcomeText(value: unknown, minLength: number) {
  if (typeof value !== "string") {
    return false;
  }

  const text = value.trim();
  return (
    text.length >= minLength &&
    /能|能够|完成|独立|掌握|做出|产出|应用|解决|通过|交付|上线|写出|建立|形成/.test(text)
  );
}

function runInterviewRuleChecks(testCase: EvalCase, output: string): EvalRuleCheck[] {
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
  const rawOptions = Array.isArray(parsed.options) ? parsed.options : [];
  const options = rawOptions.filter((item) => {
    if (typeof item === "string") {
      return item.trim().length > 0;
    }

    if (!item || typeof item !== "object") {
      return false;
    }

    const option = item as Record<string, unknown>;
    return typeof option.label === "string" && option.label.trim().length > 0;
  });
  const courseId = parsed.courseId;
  const input = testCase.input as unknown as InterviewEvalInput;
  const expectedInteraction = input.expectedInteraction ?? "guided";

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
      name: "preview-course-id-empty",
      passed: courseId == null,
      details:
        courseId == null
          ? "Preview output does not persist a course id."
          : `Preview unexpectedly returned courseId=${String(courseId)}.`,
    },
  ];

  if (expectedInteraction === "text") {
    checks.push(
      {
        name: "text-only-no-options",
        passed: options.length === 0,
        details: `Options count is ${options.length}. Expected no options for text-only turns.`,
      },
      {
        name: "text-only-no-outline",
        passed: outline == null,
        details: outline == null ? "No outline returned." : "Unexpected outline returned.",
      },
    );

    return checks;
  }

  checks.push({
    name: "options-count",
    passed: options.length >= 2 && options.length <= 4,
    details: `Options count is ${options.length}. Expected 2-4.`,
  });

  if (!outline || typeof outline !== "object") {
    checks.push({
      name: "outline-shape",
      passed: true,
      details: "No outline returned in this turn.",
    });
    return checks;
  }

  const outlineRecord = outline as Record<string, unknown>;
  const structuredOutlineOptions = rawOptions.filter(
    (item): item is Record<string, unknown> => !!item && typeof item === "object",
  );
  const hasStartCourseOption = structuredOutlineOptions.some(
    (option) => option.intent === "start_course",
  );
  const reviseOptions = structuredOutlineOptions.filter((option) => option.intent === "revise");
  const hasConcreteReviseActions =
    reviseOptions.length > 0 &&
    reviseOptions.every((option) => {
      const action = typeof option.action === "string" ? option.action.trim() : "";
      return action.length >= 8;
    });
  const chapters = Array.isArray(outlineRecord.chapters)
    ? outlineRecord.chapters.filter(
        (chapter): chapter is Record<string, unknown> => !!chapter && typeof chapter === "object",
      )
    : [];

  checks.push(
    {
      name: "outline-actions-structured",
      passed:
        structuredOutlineOptions.length === rawOptions.length &&
        structuredOutlineOptions.every(
          (option) => option.intent === "revise" || option.intent === "start_course",
        ) &&
        hasStartCourseOption &&
        hasConcreteReviseActions,
      details:
        structuredOutlineOptions.length === rawOptions.length &&
        hasStartCourseOption &&
        hasConcreteReviseActions
          ? "Outline options are structured actions with concrete revise commands and start_course."
          : "Outline options must be structured revise/start_course actions; revise options need concrete action text and one option must start course.",
    },
    {
      name: "outline-metadata",
      passed:
        typeof outlineRecord.title === "string" &&
        outlineRecord.title.trim().length > 0 &&
        hasConcreteOutcomeText(outlineRecord.description, 30) &&
        typeof outlineRecord.targetAudience === "string" &&
        outlineRecord.targetAudience.trim().length >= 10 &&
        hasConcreteOutcomeText(outlineRecord.learningOutcome, 20) &&
        typeof outlineRecord.difficulty === "string" &&
        outlineRecord.difficulty.trim().length > 0,
      details:
        "Outline preview must contain product-quality title, description, targetAudience, learningOutcome, and difficulty.",
    },
    {
      name: "course-title-product-quality",
      passed: typeof outlineRecord.title === "string" && !isGenericCourseTitle(outlineRecord.title),
      details:
        typeof outlineRecord.title === "string"
          ? `Course title is "${outlineRecord.title}".`
          : "Course title is missing.",
    },
    {
      name: "chapter-count",
      passed:
        chapters.length >= INTERVIEW_OUTLINE_CHAPTER_LIMITS.min &&
        chapters.length <= INTERVIEW_OUTLINE_CHAPTER_LIMITS.max,
      details: `Outline chapter count is ${chapters.length}. Expected ${INTERVIEW_OUTLINE_CHAPTER_LIMITS.min}-${INTERVIEW_OUTLINE_CHAPTER_LIMITS.max}.`,
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
    if (
      sections.length < INTERVIEW_OUTLINE_SECTION_LIMITS.min ||
      sections.length > INTERVIEW_OUTLINE_SECTION_LIMITS.max
    ) {
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
        ? `All chapters contain ${INTERVIEW_OUTLINE_SECTION_LIMITS.min}-${INTERVIEW_OUTLINE_SECTION_LIMITS.max} skeleton sections.`
        : `Chapters with invalid skeleton section counts: ${invalidChapterIndexes.join(", ")}.`,
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

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function buildRoutingDeterministicJudgement(ruleChecks: EvalRuleCheck[]): {
  score: number;
  notes: string[];
} {
  const passedRuleCount = ruleChecks.filter((check) => check.passed).length;
  const failedRuleNames = ruleChecks.filter((check) => !check.passed).map((check) => check.name);
  const score = ruleChecks.length > 0 ? passedRuleCount / ruleChecks.length : 1;

  return {
    score: clampScore(score),
    notes:
      failedRuleNames.length === 0
        ? [`Routing contract passed ${passedRuleCount}/${ruleChecks.length} deterministic checks.`]
        : [`Routing failed checks: ${failedRuleNames.join(", ")}.`],
  };
}

function buildDeterministicJudgement(
  label: string,
  ruleChecks: EvalRuleCheck[],
): {
  score: number;
  notes: string[];
} {
  const passedRuleCount = ruleChecks.filter((check) => check.passed).length;
  const failedRuleNames = ruleChecks.filter((check) => !check.passed).map((check) => check.name);
  const score = ruleChecks.length > 0 ? passedRuleCount / ruleChecks.length : 1;

  return {
    score: clampScore(score),
    notes:
      failedRuleNames.length === 0
        ? [`${label} passed ${passedRuleCount}/${ruleChecks.length} deterministic checks.`]
        : [`${label} failed checks: ${failedRuleNames.join(", ")}.`],
  };
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
      return runInterviewRuleChecks(testCase, output);
    case "routing":
      return runRoutingRuleChecks(testCase, output);
    case "career-tree":
      return runCareerTreeRuleChecks(testCase, output);
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

function buildContractAssessment(ruleChecks: EvalRuleCheck[]): EvalContractAssessment {
  const failedRuleNames = ruleChecks.filter((check) => !check.passed).map((check) => check.name);
  const passedRuleCount = ruleChecks.filter((check) => check.passed).length;

  return {
    score: ruleChecks.length > 0 ? passedRuleCount / ruleChecks.length : 1,
    passed: failedRuleNames.length === 0,
    failedRuleNames,
  };
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
        capabilityMode: "general_chat",
        telemetry,
        startedAt,
      });
    } else if (generationInput.mode === "agent-notes") {
      generationResult = await runChatEval({
        prompt: generationInput.prompt,
        capabilityMode: "note_assistant",
        userContext: `## 当前笔记内容\n${generationInput.noteExcerpt}`,
        telemetry,
        startedAt,
      });
    } else if (generationInput.mode === "agent-interview") {
      generationResult = await runInterviewEval({
        prompt: generationInput.prompt,
        messages: generationInput.messages,
        currentOutline: generationInput.currentOutline,
        telemetry,
        startedAt,
      });
    } else if (generationInput.mode === "routing") {
      generationResult = await runRoutingEval({
        prompt: generationInput.prompt,
        requestContext: generationInput.requestContext,
        startedAt,
      });
    } else if (generationInput.mode === "career-tree-graph") {
      generationResult = runCareerTreeGraphEval({
        snapshot: generationInput.snapshot,
        directionKey: generationInput.directionKey,
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
    const contract = buildContractAssessment(ruleChecks);
    const deterministicJudgement =
      testCase.domain === "routing"
        ? buildRoutingDeterministicJudgement(ruleChecks)
        : testCase.domain === "career-tree"
          ? buildDeterministicJudgement("Career tree graph", ruleChecks)
          : null;
    const judgement =
      deterministicJudgement ?? (await judgeEvalOutput(testCase, generationResult.output));
    const quality: EvalQualityAssessment = deterministicJudgement
      ? {
          source: "deterministic",
          score: judgement.score,
          passed: judgement.score >= 0.8,
          notes: judgement.notes,
        }
      : {
          source: "ai-judge",
          score: judgement.score,
          passed: judgement.score >= 0.8,
          notes: judgement.notes,
        };

    return {
      caseId: testCase.id,
      title: testCase.title,
      passed: contract.passed,
      contract,
      quality,
      output: generationResult.output,
      ruleChecks,
      runtimeMetrics: generationResult.runtimeMetrics,
    };
  } catch (error) {
    return {
      caseId: testCase.id,
      title: testCase.title,
      passed: false,
      contract: {
        score: 0,
        passed: false,
        failedRuleNames: ["execution-error"],
      },
      quality: {
        source: "deterministic",
        score: 0,
        passed: false,
        notes: [`Eval execution failed: ${getErrorMessage(error)}`],
      },
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
    ...buildGenerationSettingsForPolicy(modelPolicy, {
      temperature: 0.2,
    }),
    timeout: EVAL_TEXT_TIMEOUT_MS,
  });

  const totalMs = Date.now() - startedAt;

  if (EVAL_RECORD_USAGE) {
    await recordAIUsage({
      ...telemetry,
      usage: generated.usage,
      durationMs: totalMs,
      success: true,
    });
  }

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
  capabilityMode,
  userContext,
  telemetry,
  startedAt,
}: {
  prompt: string;
  capabilityMode: "general_chat" | "note_assistant";
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

    const agent = await createConversationSpecialistAgent({
      mode: capabilityMode,
      options: {
        userId: "eval-user",
        userContext,
        telemetry: EVAL_RECORD_USAGE ? telemetry : undefined,
      },
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
        const text = extractUIMessageText(uiMessage, { separator: "" });

        if (text.length > 0) {
          firstTextMs = Date.now() - startedAt;
        }
      }
    }

    const finalMessages = [...latestById.values()];
    const lastAssistant = [...finalMessages]
      .reverse()
      .find((message) => message.role === "assistant");
    const text = lastAssistant ? extractUIMessageText(lastAssistant) : "";

    const totalMs = Date.now() - startedAt;

    if (EVAL_RECORD_USAGE) {
      await recordAIUsage({
        ...telemetry,
        durationMs: totalMs,
        success: true,
        metadata: {
          ...telemetry.metadata,
          mode: capabilityMode === "note_assistant" ? "agent-notes" : "agent-chat",
        },
      });
    }

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
  messages: inputMessages,
  currentOutline,
  telemetry,
  startedAt,
}: {
  prompt: string;
  messages?: InterviewEvalInput["messages"];
  currentOutline?: InterviewEvalInput["currentOutline"];
  telemetry: ReturnType<typeof createTelemetryContext>;
  startedAt: number;
}): Promise<EvalGenerationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("eval-timeout"), EVAL_AGENT_TIMEOUT_MS);

  try {
    const messages: InterviewUIMessage[] =
      inputMessages && inputMessages.length > 0
        ? inputMessages.map((message) => ({
            id: `eval-${message.role}-${crypto.randomUUID()}`,
            role: message.role,
            parts: [{ type: "text" as const, text: message.text }],
          }))
        : [
            {
              id: `eval-user-${crypto.randomUUID()}`,
              role: "user",
              parts: [{ type: "text", text: prompt }],
            },
          ];

    const agent = createCourseInterviewerSpecialistAgent({
      userId: "eval-user",
      currentOutline,
      messages,
      telemetry: EVAL_RECORD_USAGE ? telemetry : undefined,
    });

    const modelMessages = await convertToModelMessages(messages, {
      tools: agent.tools,
    });

    const result = await agent.stream({
      prompt: modelMessages,
      abortSignal: controller.signal,
    });

    const latestById = new Map<string, InterviewUIMessage>();
    let latestVisibleAssistantSnapshot: ReturnType<
      typeof getLatestVisibleInterviewAssistantMessage
    > = null;
    let latestStableOutlineSnapshot: ReturnType<typeof findLatestStableOutline> = null;
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

      const visibleMessage = getLatestVisibleInterviewAssistantMessage([uiMessage]);
      if (visibleMessage && (visibleMessage.text.length > 0 || visibleMessage.options?.length)) {
        latestVisibleAssistantSnapshot = visibleMessage;
      }

      const stableOutline = findLatestStableOutline([uiMessage]);
      if (stableOutline) {
        latestStableOutlineSnapshot = stableOutline;
      }

      if (firstTextMs == null && getInterviewMessageText(uiMessage).length > 0) {
        firstTextMs = Date.now() - startedAt;
      }

      if (firstOptionsMs == null && getInterviewMessageOptions(uiMessage).length > 0) {
        firstOptionsMs = Date.now() - startedAt;
      }

      if (firstOutlineMs == null) {
        const outline = findLatestOutline([uiMessage]);
        if (outline?.outline && outline.outline.chapters.length > 0) {
          firstOutlineMs = Date.now() - startedAt;
        }
      }
    }

    const finalMessages = [...latestById.values()];
    const finalAssistant = getLatestVisibleInterviewAssistantMessage(finalMessages);
    const lastAssistant =
      finalAssistant &&
      (finalAssistant.text.length > 0 || (finalAssistant.options?.length ?? 0) > 0)
        ? finalAssistant
        : latestVisibleAssistantSnapshot;
    const latestOutline = findLatestStableOutline(finalMessages) ?? latestStableOutlineSnapshot;

    const text = lastAssistant?.text ?? "";
    const options = lastAssistant?.options ?? [];
    const totalMs = Date.now() - startedAt;

    if (EVAL_RECORD_USAGE) {
      await recordAIUsage({
        ...telemetry,
        durationMs: totalMs,
        success: true,
        metadata: {
          ...telemetry.metadata,
          mode: "agent-interview",
        },
      });
    }

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

function runRoutingRuleChecks(testCase: EvalCase, output: string): EvalRuleCheck[] {
  const parsed = routeDecisionSchema.safeParse(parseJsonOutput(output));

  if (!parsed.success) {
    return [
      {
        name: "valid-route-decision",
        passed: false,
        details: "Routing eval output is not a valid RouteDecision JSON payload.",
      },
    ];
  }

  const input = testCase.input as unknown as RoutingEvalInput;
  const expected = input.expectedRoute;
  const decision = parsed.data;

  return [
    {
      name: "requested-capability-mode",
      passed: decision.capabilityMode === expected.capabilityMode,
      details: `Expected capabilityMode=${expected.capabilityMode}, got ${decision.capabilityMode}.`,
    },
    {
      name: "resolved-capability-mode",
      passed: decision.resolvedCapabilityMode === expected.resolvedCapabilityMode,
      details: `Expected resolvedCapabilityMode=${expected.resolvedCapabilityMode}, got ${decision.resolvedCapabilityMode}.`,
    },
    {
      name: "execution-mode",
      passed: decision.executionMode === expected.executionMode,
      details: `Expected executionMode=${expected.executionMode}, got ${decision.executionMode}.`,
    },
    {
      name: "handoff-target",
      passed: (decision.handoffTarget ?? null) === (expected.handoffTarget ?? null),
      details: `Expected handoffTarget=${String(expected.handoffTarget ?? null)}, got ${String(decision.handoffTarget ?? null)}.`,
    },
    {
      name: "has-route-reasons",
      passed: decision.reasons.length > 0 && decision.arbiterNotes.length > 0,
      details: "RouteDecision should include both classifier reasons and arbiter notes.",
    },
  ];
}

function runCareerTreeRuleChecks(testCase: EvalCase, output: string): EvalRuleCheck[] {
  const parsed = JSON.parse(output) as unknown;
  const input = testCase.input as unknown as CareerTreeEvalInput;
  const expected = input.expected;
  const expectGraph = expected.expectGraph ?? true;

  if (!parsed || typeof parsed !== "object") {
    return [
      {
        name: "career-graph-present",
        passed: !expectGraph,
        details: expectGraph
          ? "Expected a career development graph, but output was null."
          : "No graph returned as expected.",
      },
    ];
  }

  const graph = parsed as {
    currentCareer?: { key?: unknown };
    futureCareers?: Array<{ title?: unknown; source?: unknown }>;
  };
  const futureCareers = Array.isArray(graph.futureCareers) ? graph.futureCareers : [];
  const futureTitles = futureCareers
    .map((role) => (typeof role.title === "string" ? role.title : ""))
    .filter(Boolean);
  const futureSources = futureCareers
    .map((role) => (typeof role.source === "string" ? role.source : ""))
    .filter(Boolean);
  const checks: EvalRuleCheck[] = [
    {
      name: "career-graph-shape",
      passed: !!graph.currentCareer && Array.isArray(graph.futureCareers),
      details: "Career graph must include currentCareer and futureCareers.",
    },
  ];

  if (expected.currentCareerKey) {
    checks.push({
      name: "current-career-key",
      passed: graph.currentCareer?.key === expected.currentCareerKey,
      details: `Expected currentCareer.key=${expected.currentCareerKey}, got ${String(graph.currentCareer?.key ?? null)}.`,
    });
  }

  if (expected.expectedFutureCount != null) {
    checks.push({
      name: "future-career-count",
      passed: futureCareers.length === expected.expectedFutureCount,
      details: `Expected ${expected.expectedFutureCount} future career(s), got ${futureCareers.length}.`,
    });
  }

  if (expected.futureSources) {
    checks.push({
      name: "future-career-sources",
      passed:
        expected.futureSources.length === futureSources.length &&
        expected.futureSources.every((source, index) => futureSources[index] === source),
      details: `Expected future sources ${expected.futureSources.join(",")}, got ${futureSources.join(",") || "(none)"}.`,
    });
  }

  for (const title of expected.requiredFutureTitles ?? []) {
    checks.push({
      name: `required-future-title:${title}`,
      passed: futureTitles.includes(title),
      details: futureTitles.includes(title)
        ? `Future careers include "${title}".`
        : `Future careers are missing "${title}".`,
    });
  }

  for (const title of expected.forbiddenFutureTitles ?? []) {
    checks.push({
      name: `forbidden-future-title:${title}`,
      passed: !futureTitles.includes(title),
      details: futureTitles.includes(title)
        ? `Future careers unexpectedly include "${title}".`
        : `Future careers do not include "${title}".`,
    });
  }

  return checks;
}

function runCareerTreeGraphEval({
  snapshot,
  directionKey,
  startedAt,
}: {
  snapshot: CareerTreeEvalInput["snapshot"];
  directionKey?: string | null;
  startedAt: number;
}): EvalGenerationResult {
  const graph = buildCareerDevelopmentGraph(snapshot, directionKey);
  const totalMs = Date.now() - startedAt;

  return {
    output: JSON.stringify(graph, null, 2),
    runtimeMetrics: {
      totalMs,
      firstTextMs: totalMs,
      firstOptionsMs: null,
      firstOutlineMs: null,
      timedOut: false,
    },
  };
}

async function runRoutingEval({
  prompt,
  requestContext: inputContext,
  startedAt,
}: {
  prompt: string;
  requestContext: RoutingEvalInput["requestContext"];
  startedAt: number;
}): Promise<EvalGenerationResult> {
  const { orchestrateRequest } = await import("@/lib/ai/runtime/orchestrate-request");

  const metadata =
    inputContext.metadataContext === "learn" && inputContext.courseId
      ? {
          context: "learn" as const,
          courseId: inputContext.courseId,
          chapterIndex: inputContext.chapterIndex ?? 0,
          sectionIndex: inputContext.sectionIndex,
        }
      : inputContext.metadataContext === "editor" && inputContext.documentId
        ? {
            context: "editor" as const,
            documentId: inputContext.documentId,
          }
        : undefined;

  const routeDecision = await orchestrateRequest({
    userId: "eval-user",
    messages: [
      {
        id: `eval-user-${crypto.randomUUID()}`,
        role: "user",
        parts: [{ type: "text", text: prompt }],
      },
    ],
    requestContext: {
      surface: inputContext.surface,
      sessionId: null,
      recentMessages: inputContext.recentMessages ?? [prompt],
      metadata,
      resourceContext: {
        courseId: inputContext.courseId,
        chapterIndex: inputContext.chapterIndex,
        sectionIndex: inputContext.sectionIndex,
        documentId: inputContext.documentId,
      },
      hasLearningGuidance: inputContext.hasLearningGuidance,
      hasCareerTreeSnapshot: inputContext.hasCareerTreeSnapshot,
      hasEditorContext: inputContext.hasEditorContext,
      userPolicy: {
        routeProfile: "platform",
        skinSlug: null,
      },
      learningGuidance: undefined,
    },
  });
  const totalMs = Date.now() - startedAt;

  return {
    output: JSON.stringify(routeDecision, null, 2),
    runtimeMetrics: {
      totalMs,
      firstTextMs: totalMs,
      firstOptionsMs: null,
      firstOutlineMs: null,
      timedOut: false,
    },
  };
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

  const totalContractScore = results.reduce((sum, result) => sum + result.contract.score, 0);
  const qualityScores = results
    .map((result) => result.quality?.score ?? null)
    .filter((score): score is number => score != null);
  const contractPassCount = results.filter((result) => result.passed).length;
  const qualityWarningCount = results.filter(
    (result) => result.passed && result.quality != null && !result.quality.passed,
  ).length;

  return {
    domain: suite.domain,
    version: suite.version,
    averageContractScore: results.length > 0 ? totalContractScore / results.length : 0,
    averageQualityScore:
      qualityScores.length > 0
        ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
        : null,
    contractPassCount,
    qualityWarningCount,
    qualityCaseCount: qualityScores.length,
    totalCount: results.length,
    results,
  };
}

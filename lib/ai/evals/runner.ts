import { convertToModelMessages, generateText, readUIMessageStream, type UIMessage } from "ai";
import { createInterviewAgent } from "@/lib/ai/agents/interview";
import { getModelForPolicy } from "@/lib/ai/core/model-policy";
import { buildPromptInstructions } from "@/lib/ai/core/prompt-registry";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import {
  findLatestOutline,
  findLatestStableOutline,
  getInterviewMessageOptions,
  getInterviewMessageText,
  type InterviewUIMessage,
} from "@/lib/ai/interview";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { composeGrowthTrees, treeComposerOutputSchema } from "@/lib/growth/compose";
import { judgeEvalOutput } from "./judge";
import type {
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
  GrowthEvalInput,
  InterviewEvalInput,
  LearnEvalInput,
  NotesEvalInput,
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

interface GrowthComposerEvalNode {
  anchorRef: string;
  children: GrowthComposerEvalNode[];
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
      sessionMode?: InterviewEvalInput["mode"];
    }
  | {
      mode: "text";
      prompt: string;
      instructions: string;
    }
  | {
      mode: "growth-compose";
      graph: GrowthEvalInput["graph"];
      preference: GrowthEvalInput["preference"];
      previousSummary: GrowthEvalInput["previousSummary"];
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
        sessionMode: input.mode,
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
    case "growth": {
      const input = testCase.input as unknown as GrowthEvalInput;
      return {
        mode: "growth-compose",
        graph: input.graph,
        preference: input.preference,
        previousSummary: input.previousSummary,
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
      const input = testCase.input as unknown as InterviewEvalInput;
      return input.mode === "structured"
        ? ("structured-high-quality" as const)
        : ("interactive-fast" as const);
    }
    case "growth":
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

function collectComposerAnchorRefs(nodes: GrowthComposerEvalNode[]): string[] {
  const refs: string[] = [];

  for (const node of nodes) {
    refs.push(node.anchorRef);
    refs.push(...collectComposerAnchorRefs(node.children));
  }

  return refs;
}

function jaccardOverlap(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (leftSet.size === 0 || rightSet.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersection += 1;
    }
  }

  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 0 : intersection / union;
}

function clampScore(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function runGrowthComposeRuleChecks(testCase: EvalCase, output: string): EvalRuleCheck[] {
  const parsed = parseJsonOutput(output);

  if (!parsed) {
    return [
      {
        name: "valid-json-output",
        passed: false,
        details: "Growth eval output is not valid JSON.",
      },
    ];
  }

  const composerOutput = treeComposerOutputSchema.safeParse(parsed);
  if (!composerOutput.success) {
    return [
      {
        name: "valid-growth-schema",
        passed: false,
        details: composerOutput.error.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; "),
      },
    ];
  }

  const input = testCase.input as unknown as GrowthEvalInput;
  const nodeIds = new Set(input.graph.nodes.map((node) => node.id));
  const previousDirectionKeys = new Set(
    input.previousSummary?.trees.map((tree) => tree.directionKey) ?? [],
  );
  const trees = composerOutput.data.trees;
  const recommendedHint = composerOutput.data.recommendedDirectionHint;
  const validRecommendedHints = new Set(
    trees.flatMap((tree) =>
      [tree.keySeed, tree.matchPreviousDirectionKey].filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  );

  const invalidSupportingRefs = trees.flatMap((tree) =>
    tree.supportingNodeRefs
      .filter((ref) => !nodeIds.has(ref))
      .map((ref) => `${tree.keySeed}:${ref}`),
  );
  const invalidAnchorRefs = trees.flatMap((tree) =>
    collectComposerAnchorRefs(tree.tree)
      .filter((ref) => !nodeIds.has(ref))
      .map((ref) => `${tree.keySeed}:${ref}`),
  );
  const invalidPreviousMatches = trees
    .filter(
      (tree) =>
        tree.matchPreviousDirectionKey != null &&
        !previousDirectionKeys.has(tree.matchPreviousDirectionKey),
    )
    .map((tree) => `${tree.keySeed}:${tree.matchPreviousDirectionKey}`);
  const duplicateTitles = new Set<string>();
  const duplicateKeySeeds = new Set<string>();
  const seenTitles = new Set<string>();
  const seenKeySeeds = new Set<string>();

  for (const tree of trees) {
    const normalizedTitle = tree.title.trim().toLocaleLowerCase("zh-CN");
    if (seenTitles.has(normalizedTitle)) {
      duplicateTitles.add(tree.title);
    }
    seenTitles.add(normalizedTitle);

    const normalizedKeySeed = tree.keySeed.trim().toLocaleLowerCase("zh-CN");
    if (seenKeySeeds.has(normalizedKeySeed)) {
      duplicateKeySeeds.add(tree.keySeed);
    }
    seenKeySeeds.add(normalizedKeySeed);
  }

  return [
    {
      name: "tree-count-range",
      passed: trees.length >= input.expectedMinTrees && trees.length <= input.expectedMaxTrees,
      details: `Tree count is ${trees.length}. Expected ${input.expectedMinTrees}-${input.expectedMaxTrees}.`,
    },
    {
      name: "recommended-direction-hint",
      passed: recommendedHint != null && validRecommendedHints.has(recommendedHint),
      details:
        recommendedHint == null
          ? "Composer did not return recommendedDirectionHint."
          : validRecommendedHints.has(recommendedHint)
            ? `recommendedDirectionHint "${recommendedHint}" maps to a returned tree.`
            : `recommendedDirectionHint "${recommendedHint}" does not map to any returned tree.`,
    },
    {
      name: "supporting-node-refs-exist",
      passed: invalidSupportingRefs.length === 0,
      details:
        invalidSupportingRefs.length === 0
          ? "All supportingNodeRefs exist in the input graph."
          : `Unknown supportingNodeRefs: ${invalidSupportingRefs.join(", ")}.`,
    },
    {
      name: "anchor-refs-exist",
      passed: invalidAnchorRefs.length === 0,
      details:
        invalidAnchorRefs.length === 0
          ? "All visible tree anchor refs exist in the input graph."
          : `Unknown anchor refs: ${invalidAnchorRefs.join(", ")}.`,
    },
    {
      name: "previous-direction-matches",
      passed: invalidPreviousMatches.length === 0,
      details:
        invalidPreviousMatches.length === 0
          ? "All matchPreviousDirectionKey values map to previous directions."
          : `Unknown previous direction matches: ${invalidPreviousMatches.join(", ")}.`,
    },
    {
      name: "distinct-direction-titles",
      passed: duplicateTitles.size === 0,
      details:
        duplicateTitles.size === 0
          ? "All direction titles are distinct."
          : `Duplicate direction titles: ${[...duplicateTitles].join(", ")}.`,
    },
    {
      name: "distinct-key-seeds",
      passed: duplicateKeySeeds.size === 0,
      details:
        duplicateKeySeeds.size === 0
          ? "All direction key seeds are distinct."
          : `Duplicate key seeds: ${[...duplicateKeySeeds].join(", ")}.`,
    },
  ];
}

function buildGrowthDeterministicJudgement(
  testCase: EvalCase,
  output: string,
  ruleChecks: EvalRuleCheck[],
): { score: number; notes: string[] } {
  const parsed = treeComposerOutputSchema.safeParse(parseJsonOutput(output));

  if (!parsed.success) {
    return {
      score: 0,
      notes: ["Growth eval output does not match the expected structured schema."],
    };
  }

  const input = testCase.input as unknown as GrowthEvalInput;
  const trees = parsed.data.trees;
  const passedRuleCount = ruleChecks.filter((check) => check.passed).length;
  const baseScore = ruleChecks.length > 0 ? passedRuleCount / ruleChecks.length : 1;
  const pairwiseOverlaps: number[] = [];

  for (let leftIndex = 0; leftIndex < trees.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < trees.length; rightIndex++) {
      pairwiseOverlaps.push(
        jaccardOverlap(trees[leftIndex].supportingNodeRefs, trees[rightIndex].supportingNodeRefs),
      );
    }
  }

  let score = baseScore;
  const notes: string[] = [];
  const maxOverlap = pairwiseOverlaps.length > 0 ? Math.max(...pairwiseOverlaps) : 0;

  if (input.expectedMinTrees >= 2) {
    if (trees.length >= 2) {
      notes.push(`生成了 ${trees.length} 棵候选树，数量符合强信号用户的预期范围。`);
    } else {
      score -= 0.25;
      notes.push("强信号用户没有得到足够多的候选树。");
    }
  } else if (trees.length <= input.expectedMaxTrees) {
    notes.push(`仅生成了 ${trees.length} 棵方向，符合弱信号用户应保守收敛的预期。`);
  }

  if (maxOverlap >= 0.85) {
    score -= 0.2;
    notes.push(`候选树之间重叠过高（最大 supportingNodeRefs overlap=${maxOverlap.toFixed(2)}）。`);
  } else if (trees.length > 1) {
    notes.push(`候选树之间保持了可分辨的支撑节点差异（最大 overlap=${maxOverlap.toFixed(2)}）。`);
  }

  const duplicateTitleRule = ruleChecks.find((check) => check.name === "distinct-direction-titles");
  if (!duplicateTitleRule?.passed) {
    score -= 0.2;
    notes.push("候选树标题仍然存在重复，区分度不够。");
  } else if (trees.length > 1) {
    notes.push("候选树标题和方向语义已经区分开了。");
  }

  score = clampScore(score);
  return {
    score,
    notes: notes.slice(0, 5),
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
      return runInterviewRuleChecks(output);
    case "growth":
      return runGrowthComposeRuleChecks(testCase, output);
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
        mode: generationInput.sessionMode,
        telemetry,
        startedAt,
      });
    } else if (generationInput.mode === "growth-compose") {
      generationResult = await runGrowthComposeEval({
        graph: generationInput.graph,
        preference: generationInput.preference,
        previousSummary: generationInput.previousSummary,
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
    const judgement =
      testCase.domain === "growth"
        ? buildGrowthDeterministicJudgement(testCase, generationResult.output, ruleChecks)
        : await judgeEvalOutput(testCase, generationResult.output);
    const quality: EvalQualityAssessment =
      testCase.domain === "growth"
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
    temperature: 0.2,
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
  const { createChatAgent } = await import("@/lib/ai/agents/chat");
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
          mode: profile === "NOTE_ASSIST" ? "agent-notes" : "agent-chat",
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
  currentOutline,
  mode,
  telemetry,
  startedAt,
}: {
  prompt: string;
  currentOutline?: InterviewEvalInput["currentOutline"];
  mode?: InterviewEvalInput["mode"];
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

    const agent = await createInterviewAgent({
      userId: "eval-user",
      currentOutline,
      messages,
      mode,
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
    const latestOutline = findLatestStableOutline(finalMessages);

    const text = lastAssistant ? getInterviewMessageText(lastAssistant) : "";
    const options = lastAssistant ? getInterviewMessageOptions(lastAssistant) : [];
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

async function runGrowthComposeEval({
  graph,
  preference,
  previousSummary,
  startedAt,
}: {
  graph: GrowthEvalInput["graph"];
  preference: GrowthEvalInput["preference"];
  previousSummary: GrowthEvalInput["previousSummary"];
  startedAt: number;
}): Promise<EvalGenerationResult> {
  const composed = await composeGrowthTrees({
    userId: "eval-user",
    graph,
    preference,
    previousSummary,
    recordUsage: false,
  });
  const totalMs = Date.now() - startedAt;

  return {
    output: JSON.stringify(composed, null, 2),
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

export function summarizeEvalSuite<TInput>(suite: EvalSuite<TInput>) {
  return {
    domain: suite.domain,
    version: suite.version,
    caseCount: suite.cases.length,
    caseIds: suite.cases.map((testCase) => testCase.id),
  };
}

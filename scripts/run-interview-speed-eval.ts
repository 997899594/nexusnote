import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { convertToModelMessages, getToolName, isToolUIPart, readUIMessageStream } from "ai";
import { env } from "@/config/env";
import { createInterviewSessionAgent } from "@/lib/ai/agents/interview-session";
import {
  createInterviewTimingRecorder,
  type InterviewTimingEvent,
} from "@/lib/ai/interview/timing";
import {
  findLatestOutline,
  findLatestStableOutline,
  getInterviewMessageOptions,
  getInterviewMessageText,
  type InterviewUIMessage,
} from "@/lib/ai/interview/ui";
import { type InterviewEvalInput, interviewEvalSuite } from "@/tests/ai-evals";

type SpeedMode = "natural" | "structured";

interface CliOptions {
  repeats: number;
  timeoutMs: number;
  modes: SpeedMode[];
  caseIds: string[];
}

interface InterviewSpeedMetrics {
  totalMs: number;
  createAgentMs: number | null;
  stateExtractMs: number | null;
  aiStateExtractMs: number | null;
  convertMessagesMs: number | null;
  streamCallMs: number | null;
  streamReadMs: number | null;
  firstAssistantMs: number | null;
  firstToolMs: number | null;
  firstTextMs: number | null;
  firstOptionsMs: number | null;
  firstLiveOutlineMs: number | null;
  firstOutlineMs: number | null;
}

interface InterviewSpeedRun {
  caseId: string;
  title: string;
  originalMode: SpeedMode;
  mode: SpeedMode;
  repeatIndex: number;
  success: boolean;
  timedOut: boolean;
  outputKind: "outline" | "options" | "empty";
  errorMessage: string | null;
  metrics: InterviewSpeedMetrics;
  events: InterviewTimingEvent[];
}

interface NumericSummary {
  count: number;
  min: number | null;
  p50: number | null;
  p90: number | null;
  max: number | null;
  mean: number | null;
}

interface GroupSummary {
  caseId: string;
  mode: SpeedMode;
  runs: number;
  successCount: number;
  timeoutCount: number;
  outlineCount: number;
  optionsCount: number;
  totalMs: NumericSummary;
  firstTextMs: NumericSummary;
  firstOptionsMs: NumericSummary;
  firstLiveOutlineMs: NumericSummary;
  firstOutlineMs: NumericSummary;
  createAgentMs: NumericSummary;
  stateExtractMs: NumericSummary;
  aiStateExtractMs: NumericSummary;
  streamReadMs: NumericSummary;
}

interface InterviewSpeedCase {
  id: string;
  title: string;
  input: InterviewEvalInput;
}

const SPEED_EXTRA_CASES: InterviewSpeedCase[] = [
  {
    id: "speed-photography-portrait-one-month",
    title: "跨领域：一个月人像摄影交付",
    input: {
      mode: "structured",
      userGoal: "我想学摄影，一个月后能拍出可交付的人像作品，目前只会手机拍照。",
    },
  },
  {
    id: "speed-exam-math-weak-foundation",
    title: "跨领域：考研数学弱基础补齐",
    input: {
      mode: "structured",
      userGoal: "我想准备考研数学，基础很弱，希望三个月把高数和线代补起来。",
    },
  },
  {
    id: "speed-japanese-news-conversation",
    title: "跨领域：日语新闻和日常交流",
    input: {
      mode: "natural",
      userGoal: "我想学日语，半年后能看懂基础新闻，也能进行日常交流，目前只会五十音。",
    },
  },
  {
    id: "speed-short-video-operations",
    title: "跨领域：短视频运营首批内容",
    input: {
      mode: "natural",
      userGoal: "我想学短视频运营，两周内做出账号内容计划并发第一批视频，之前没系统做过。",
    },
  },
];

const DEFAULT_REPEATS = 3;
const DEFAULT_TIMEOUT_MS = 45_000;
const OUTPUT_DIR = "artifacts/evals/interview-speed";
const SPEED_MODES: SpeedMode[] = ["natural", "structured"];

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCliOptions(): CliOptions {
  const args = process.argv.slice(2);
  const repeatsArg = args.find((arg) => arg.startsWith("--repeats="))?.split("=")[1];
  const timeoutArg = args.find((arg) => arg.startsWith("--timeout-ms="))?.split("=")[1];
  const modesArg = args.find((arg) => arg.startsWith("--mode="))?.split("=")[1];
  const caseArg = args.find((arg) => arg.startsWith("--case="))?.split("=")[1];
  const modes = modesArg
    ? modesArg
        .split(",")
        .map((mode) => mode.trim())
        .filter((mode): mode is SpeedMode => mode === "natural" || mode === "structured")
    : SPEED_MODES;

  return {
    repeats: parsePositiveInt(repeatsArg ?? process.env.INTERVIEW_SPEED_REPEATS, DEFAULT_REPEATS),
    timeoutMs: parsePositiveInt(
      timeoutArg ?? process.env.INTERVIEW_SPEED_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
    ),
    modes: modes.length > 0 ? modes : SPEED_MODES,
    caseIds: caseArg
      ? caseArg
          .split(",")
          .map((caseId) => caseId.trim())
          .filter(Boolean)
      : [],
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTimeoutError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("eval-timeout") ||
    message.includes("aborted") ||
    message.includes("aborterror") ||
    message.includes("timed out") ||
    message.includes("timeout")
  );
}

function findEvent(events: InterviewTimingEvent[], stage: string): InterviewTimingEvent | null {
  return events.find((event) => event.stage === stage) ?? null;
}

function stageDuration(events: InterviewTimingEvent[], startStage: string, endStage: string) {
  const start = findEvent(events, startStage);
  const end = findEvent(events, endStage);
  if (!start || !end) {
    return null;
  }

  return Math.max(0, end.elapsedMs - start.elapsedMs);
}

function outputKindFromState(params: {
  hasOutline: boolean;
  hasOptions: boolean;
  hasText: boolean;
}): InterviewSpeedRun["outputKind"] {
  if (params.hasOutline) {
    return "outline";
  }

  if (params.hasOptions || params.hasText) {
    return "options";
  }

  return "empty";
}

function collectNumeric(values: Array<number | null | undefined>): NumericSummary {
  const sorted = values
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);

  if (sorted.length === 0) {
    return {
      count: 0,
      min: null,
      p50: null,
      p90: null,
      max: null,
      mean: null,
    };
  }

  const percentile = (percent: number) => {
    const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * percent) - 1);
    return sorted[index];
  };

  return {
    count: sorted.length,
    min: sorted[0],
    p50: percentile(0.5),
    p90: percentile(0.9),
    max: sorted[sorted.length - 1],
    mean: Math.round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
  };
}

function summarizeRuns(runs: InterviewSpeedRun[]): GroupSummary[] {
  const groups = new Map<string, InterviewSpeedRun[]>();
  for (const run of runs) {
    const key = `${run.caseId}:${run.mode}`;
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }

  return [...groups.entries()]
    .map(([key, groupRuns]) => {
      const [caseId, mode] = key.split(":") as [string, SpeedMode];
      return {
        caseId,
        mode,
        runs: groupRuns.length,
        successCount: groupRuns.filter((run) => run.success).length,
        timeoutCount: groupRuns.filter((run) => run.timedOut).length,
        outlineCount: groupRuns.filter((run) => run.outputKind === "outline").length,
        optionsCount: groupRuns.filter((run) => run.outputKind === "options").length,
        totalMs: collectNumeric(groupRuns.map((run) => run.metrics.totalMs)),
        firstTextMs: collectNumeric(groupRuns.map((run) => run.metrics.firstTextMs)),
        firstOptionsMs: collectNumeric(groupRuns.map((run) => run.metrics.firstOptionsMs)),
        firstLiveOutlineMs: collectNumeric(groupRuns.map((run) => run.metrics.firstLiveOutlineMs)),
        firstOutlineMs: collectNumeric(groupRuns.map((run) => run.metrics.firstOutlineMs)),
        createAgentMs: collectNumeric(groupRuns.map((run) => run.metrics.createAgentMs)),
        stateExtractMs: collectNumeric(groupRuns.map((run) => run.metrics.stateExtractMs)),
        aiStateExtractMs: collectNumeric(groupRuns.map((run) => run.metrics.aiStateExtractMs)),
        streamReadMs: collectNumeric(groupRuns.map((run) => run.metrics.streamReadMs)),
      };
    })
    .sort((left, right) =>
      left.caseId === right.caseId
        ? left.mode.localeCompare(right.mode)
        : left.caseId.localeCompare(right.caseId),
    );
}

function getInterviewSpeedCases(): InterviewSpeedCase[] {
  return [
    ...interviewEvalSuite.cases.map((testCase) => ({
      id: testCase.id,
      title: testCase.title,
      input: testCase.input as InterviewEvalInput,
    })),
    ...SPEED_EXTRA_CASES,
  ];
}

function buildMetrics(params: {
  totalMs: number;
  events: InterviewTimingEvent[];
  firstAssistantMs: number | null;
  firstToolMs: number | null;
  firstTextMs: number | null;
  firstOptionsMs: number | null;
  firstLiveOutlineMs: number | null;
  firstOutlineMs: number | null;
}): InterviewSpeedMetrics {
  return {
    totalMs: params.totalMs,
    createAgentMs: stageDuration(params.events, "agent.create.start", "agent.create.end"),
    stateExtractMs: stageDuration(params.events, "state.extract.start", "state.extract.end"),
    aiStateExtractMs: stageDuration(
      params.events,
      "state.extract.ai.start",
      "state.extract.ai.end",
    ),
    convertMessagesMs: stageDuration(
      params.events,
      "messages.convert.start",
      "messages.convert.end",
    ),
    streamCallMs: stageDuration(params.events, "stream.call.start", "stream.call.end"),
    streamReadMs: stageDuration(params.events, "ui.stream.read.start", "ui.stream.read.end"),
    firstAssistantMs: params.firstAssistantMs,
    firstToolMs: params.firstToolMs,
    firstTextMs: params.firstTextMs,
    firstOptionsMs: params.firstOptionsMs,
    firstLiveOutlineMs: params.firstLiveOutlineMs,
    firstOutlineMs: params.firstOutlineMs,
  };
}

async function runOneInterviewSpeedCase(params: {
  caseId: string;
  title: string;
  originalMode: SpeedMode;
  mode: SpeedMode;
  prompt: string;
  currentOutline?: InterviewEvalInput["currentOutline"];
  repeatIndex: number;
  timeoutMs: number;
}): Promise<InterviewSpeedRun> {
  const startedAt = Date.now();
  const timing = createInterviewTimingRecorder(startedAt);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("eval-timeout"), params.timeoutMs);

  let firstAssistantMs: number | null = null;
  let firstToolMs: number | null = null;
  let firstTextMs: number | null = null;
  let firstOptionsMs: number | null = null;
  let firstLiveOutlineMs: number | null = null;
  let firstOutlineMs: number | null = null;
  let hasText = false;
  let hasOptions = false;
  let hasOutline = false;

  try {
    const messages: InterviewUIMessage[] = [
      {
        id: `speed-user-${crypto.randomUUID()}`,
        role: "user",
        parts: [{ type: "text", text: params.prompt }],
      },
    ];

    const agent = await createInterviewSessionAgent({
      userId: "speed-eval-user",
      currentOutline: params.currentOutline,
      messages,
      mode: params.mode,
      timing,
    });

    timing.mark("messages.convert.start");
    const modelMessages = await convertToModelMessages(messages, {
      tools: agent.tools,
    });
    timing.mark("messages.convert.end", { messageCount: modelMessages.length });

    timing.mark("stream.call.start");
    const result = await agent.stream({
      prompt: modelMessages,
      abortSignal: controller.signal,
    });
    timing.mark("stream.call.end");

    const latestById = new Map<string, InterviewUIMessage>();
    timing.mark("ui.stream.read.start");
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

      if (firstAssistantMs == null) {
        firstAssistantMs = Date.now() - startedAt;
        timing.mark("assistant.message.first");
      }

      if (
        firstToolMs == null &&
        uiMessage.parts.some(
          (part) =>
            isToolUIPart(part) &&
            (getToolName(part) === "presentOptions" ||
              getToolName(part) === "presentOutlinePreview"),
        )
      ) {
        firstToolMs = Date.now() - startedAt;
        timing.mark("tool.visible.first");
      }

      const text = getInterviewMessageText(uiMessage);
      if (firstTextMs == null && text.length > 0) {
        firstTextMs = Date.now() - startedAt;
        timing.mark("text.first");
      }
      hasText = hasText || text.length > 0;

      const options = getInterviewMessageOptions(uiMessage);
      if (firstOptionsMs == null && options.length > 0) {
        firstOptionsMs = Date.now() - startedAt;
        timing.mark("options.first", { optionCount: options.length });
      }
      hasOptions = hasOptions || options.length > 0;

      if (firstLiveOutlineMs == null) {
        const liveOutline = findLatestOutline([uiMessage]);
        if (liveOutline?.outline && liveOutline.outline.chapters.length > 0) {
          firstLiveOutlineMs = Date.now() - startedAt;
          timing.mark("outline.live.first", {
            chapterCount: liveOutline.outline.chapters.length,
          });
        }
      }

      if (firstOutlineMs == null) {
        const outline = findLatestStableOutline([uiMessage]);
        if (outline) {
          firstOutlineMs = Date.now() - startedAt;
          timing.mark("outline.first", { chapterCount: outline.outline.chapters.length });
        }
      }
      hasOutline = hasOutline || Boolean(findLatestStableOutline([uiMessage]));
    }
    timing.mark("ui.stream.read.end");

    const totalMs = Date.now() - startedAt;
    return {
      caseId: params.caseId,
      title: params.title,
      originalMode: params.originalMode,
      mode: params.mode,
      repeatIndex: params.repeatIndex,
      success: true,
      timedOut: false,
      outputKind: outputKindFromState({ hasOutline, hasOptions, hasText }),
      errorMessage: null,
      metrics: buildMetrics({
        totalMs,
        events: timing.events,
        firstAssistantMs,
        firstToolMs,
        firstTextMs,
        firstOptionsMs,
        firstLiveOutlineMs,
        firstOutlineMs,
      }),
      events: timing.events,
    };
  } catch (error) {
    timing.mark("run.error", { message: getErrorMessage(error) });
    const totalMs = Date.now() - startedAt;

    return {
      caseId: params.caseId,
      title: params.title,
      originalMode: params.originalMode,
      mode: params.mode,
      repeatIndex: params.repeatIndex,
      success: false,
      timedOut: isTimeoutError(error),
      outputKind: "empty",
      errorMessage: getErrorMessage(error),
      metrics: buildMetrics({
        totalMs,
        events: timing.events,
        firstAssistantMs,
        firstToolMs,
        firstTextMs,
        firstOptionsMs,
        firstLiveOutlineMs,
        firstOutlineMs,
      }),
      events: timing.events,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function formatSummaryValue(summary: NumericSummary): string {
  if (summary.count === 0) {
    return "-";
  }

  return `p50=${summary.p50} p90=${summary.p90} max=${summary.max}`;
}

function printSummary(summaries: GroupSummary[]): void {
  for (const summary of summaries) {
    console.log(
      [
        `[Interview Speed] ${summary.caseId} mode=${summary.mode}`,
        `runs=${summary.runs}`,
        `success=${summary.successCount}`,
        `timeouts=${summary.timeoutCount}`,
        `outline=${summary.outlineCount}`,
        `options=${summary.optionsCount}`,
        `total(${formatSummaryValue(summary.totalMs)})`,
        `firstText(${formatSummaryValue(summary.firstTextMs)})`,
        `firstLiveOutline(${formatSummaryValue(summary.firstLiveOutlineMs)})`,
        `stateExtract(${formatSummaryValue(summary.stateExtractMs)})`,
        `aiState(${formatSummaryValue(summary.aiStateExtractMs)})`,
      ].join(" "),
    );
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions();
  const selectedCases = getInterviewSpeedCases().filter((testCase) => {
    return options.caseIds.length === 0 || options.caseIds.includes(testCase.id);
  });
  const runs: InterviewSpeedRun[] = [];
  const provider = {
    baseURL: env.AI_302_BASE_URL,
    interactiveModel: env.AI_MODEL_INTERACTIVE,
    outlineModel: env.AI_MODEL_OUTLINE,
    extractModel: env.AI_MODEL_EXTRACT,
  };

  console.log(
    `[Interview Speed] cases=${selectedCases.length} repeats=${options.repeats} modes=${options.modes.join(",")} timeoutMs=${options.timeoutMs}`,
  );
  console.log(
    `[Interview Speed] provider baseURL=${provider.baseURL} interactive=${provider.interactiveModel} outline=${provider.outlineModel} extract=${provider.extractModel}`,
  );

  for (const testCase of selectedCases) {
    const input = testCase.input;
    const originalMode = input.mode ?? "natural";

    for (const mode of options.modes) {
      for (let repeatIndex = 0; repeatIndex < options.repeats; repeatIndex++) {
        const run = await runOneInterviewSpeedCase({
          caseId: testCase.id,
          title: testCase.title,
          originalMode,
          mode,
          prompt: input.userGoal,
          currentOutline: input.currentOutline,
          repeatIndex,
          timeoutMs: options.timeoutMs,
        });
        runs.push(run);

        console.log(
          [
            `[Interview Speed] ${run.success ? "PASS" : "FAIL"}`,
            `${run.caseId}`,
            `mode=${run.mode}`,
            `#${run.repeatIndex + 1}`,
            `kind=${run.outputKind}`,
            `total=${run.metrics.totalMs}ms`,
            `firstText=${run.metrics.firstTextMs ?? "-"}`,
            `firstOptions=${run.metrics.firstOptionsMs ?? "-"}`,
            `firstLiveOutline=${run.metrics.firstLiveOutlineMs ?? "-"}`,
            `firstOutline=${run.metrics.firstOutlineMs ?? "-"}`,
            run.errorMessage ? `error=${run.errorMessage}` : "",
          ]
            .filter(Boolean)
            .join(" "),
        );
      }
    }
  }

  const summaries = summarizeRuns(runs);
  printSummary(summaries);

  await mkdir(OUTPUT_DIR, { recursive: true });
  const outputPath = join(OUTPUT_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(
    outputPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        provider,
        options,
        summaries,
        runs,
      },
      null,
      2,
    ),
  );
  console.log(`[Interview Speed] wrote ${outputPath}`);
}

main().catch((error) => {
  console.error("[Interview Speed] Failed:", error);
  process.exitCode = 1;
});

import { generateText, Output } from "ai";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { extractLatestUserMessageFromApiMessages } from "./message-history";
import {
  type InterviewApiMessage,
  type InterviewOutline,
  type InterviewState,
  InterviewStateSchema,
} from "./schemas";
import {
  buildStructuredInterviewStatePrompt,
  STRUCTURED_STATE_SYSTEM_PROMPT,
} from "./structured-prompts";
import type { InterviewTimingSink } from "./timing";

interface ExtractInterviewStateOptions {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
  timing?: InterviewTimingSink;
}

function buildDeterministicReviseState({
  messages,
  currentOutline,
}: ExtractInterviewStateOptions): InterviewState | null {
  if (!currentOutline) {
    return null;
  }

  const latestUserMessage = extractLatestUserMessageFromApiMessages(messages)?.trim();
  if (!latestUserMessage) {
    return null;
  }

  return {
    phase: "revise",
    topic: currentOutline.title,
    targetOutcome: currentOutline.learningOutcome ?? null,
    currentBaseline: currentOutline.targetAudience ?? null,
    constraints: [],
    revisionIntent: latestUserMessage.slice(0, 240),
    confidence: 0.9,
  };
}

function truncateStateText(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function extractBaseline(message: string): string | null {
  const match = message.match(/(我(?:会|有|学过|做过|接触过|懂|熟悉|掌握)[^，。；;,.]{1,120})/);
  return match ? truncateStateText(match[1], 260) : null;
}

function extractConstraints(message: string): string[] {
  const constraints = new Set<string>();
  const durationMatch = message.match(
    /((?:\d+|一|两|三|四|五|六|七|八|九|十|半)[个]?(?:天|周|月|年)(?:内|后)?)/,
  );
  if (durationMatch) {
    constraints.add(`时间：${durationMatch[1]}`);
  }

  if (/作品集|portfolio/i.test(message)) {
    constraints.add("产出：作品集项目");
  } else if (/项目|应用|网站|系统|工具|demo/i.test(message)) {
    constraints.add("产出：项目作品");
  }

  return Array.from(constraints).slice(0, 4);
}

function extractTopic(message: string): string {
  const topicMatch = message.match(
    /(React|Next(?:\\.js)?|Vue|Python|SQL|数据分析|可视化|机器学习|AI|前端|后端|PPT|考研数学)/i,
  );
  if (topicMatch) {
    return topicMatch[1];
  }

  return truncateStateText(message, 160);
}

function buildDeterministicInitialState({
  messages,
  currentOutline,
}: ExtractInterviewStateOptions): InterviewState | null {
  if (currentOutline || messages.filter((message) => message.role === "assistant").length > 0) {
    return null;
  }

  const latestUserMessage = extractLatestUserMessageFromApiMessages(messages)?.trim();
  if (!latestUserMessage) {
    return null;
  }

  const baseline = extractBaseline(latestUserMessage);
  const constraints = extractConstraints(latestUserMessage);
  const hasExplicitOutcome = /想|希望|目标|为了|能够|能|做|完成|产出|作品集|项目/.test(
    latestUserMessage,
  );

  return {
    phase: "discover",
    topic: extractTopic(latestUserMessage),
    targetOutcome: hasExplicitOutcome ? truncateStateText(latestUserMessage, 260) : null,
    currentBaseline: baseline,
    constraints,
    revisionIntent: null,
    confidence: baseline || constraints.length > 0 ? 0.78 : 0.52,
  };
}

export async function extractInterviewState({
  messages,
  currentOutline,
  timing,
}: ExtractInterviewStateOptions): Promise<InterviewState> {
  const deterministicInitialState = buildDeterministicInitialState({
    messages,
    currentOutline,
  });
  if (deterministicInitialState) {
    timing?.mark("state.extract.strategy", { strategy: "deterministic-initial" });
    return deterministicInitialState;
  }

  const deterministicReviseState = buildDeterministicReviseState({
    messages,
    currentOutline,
  });
  if (deterministicReviseState) {
    timing?.mark("state.extract.strategy", { strategy: "deterministic-revise" });
    return deterministicReviseState;
  }

  timing?.mark("state.extract.ai.start");
  const result = await generateText({
    model: getPlainModelForPolicy("extract-fast"),
    output: Output.object({ schema: InterviewStateSchema }),
    system: STRUCTURED_STATE_SYSTEM_PROMPT,
    prompt: buildStructuredInterviewStatePrompt({
      messages,
      currentOutline,
    }),
    ...buildGenerationSettingsForPolicy("extract-fast", {
      temperature: 0,
    }),
    timeout: 30_000,
  });
  timing?.mark("state.extract.ai.end");

  return result.output;
}

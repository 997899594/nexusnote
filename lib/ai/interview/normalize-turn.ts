import type { DeepPartial } from "ai";
import type { InterviewOutline, InterviewPartialTurn, InterviewTurn } from "./schemas";

const MAX_OPTIONS = 4;

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeOptions(options: string[] | undefined) {
  if (!options) {
    return [] as string[];
  }

  const seen = new Set<string>();
  const normalizedOptions: string[] = [];

  for (const option of options) {
    const cleaned = option.trim();
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalizedOptions.push(cleaned);
  }

  return normalizedOptions.slice(0, MAX_OPTIONS);
}

function stripOptionEchoes(message: string, options: string[]) {
  const normalizedOptions = options.map((option) => normalizeText(option));
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const filteredLines = lines.filter((line) => {
    const candidate = normalizeText(
      line
        .replace(/^[-*•]\s*/, "")
        .replace(/^\d+[.)、]\s*/, "")
        .replace(/^[（(]?[A-Da-d一二三四五六七八九十][)）、.．]\s*/, ""),
    );

    return !normalizedOptions.some((option) => candidate === option || candidate.endsWith(option));
  });

  const result = filteredLines.join("\n").trim();
  return result || message.trim();
}

function createFallbackOptions(kind: InterviewTurn["kind"], outline?: InterviewOutline) {
  if (kind === "outline") {
    return ["开始学习", "调整一下大纲", outline ? "缩短一些时长" : "换个方向"];
  }

  return ["零基础开始", "有一些基础", "想更偏实战"];
}

export function normalizeInterviewTurn(turn: InterviewTurn): InterviewTurn {
  const options = dedupeOptions(turn.options);
  const safeOptions =
    options.length >= 2
      ? options
      : createFallbackOptions(turn.kind, turn.kind === "outline" ? turn.outline : undefined);
  const message = stripOptionEchoes(turn.message.trim(), safeOptions);

  if (turn.kind === "outline") {
    return {
      ...turn,
      message,
      options: safeOptions,
    };
  }

  return {
    ...turn,
    message,
    options: safeOptions,
  };
}

export function normalizePartialInterviewTurn(
  turn: DeepPartial<InterviewTurn> | undefined,
): InterviewPartialTurn | undefined {
  if (!turn) {
    return undefined;
  }

  return {
    kind: turn.kind,
    message: typeof turn.message === "string" ? turn.message : undefined,
    options: Array.isArray(turn.options)
      ? dedupeOptions(turn.options.filter((option): option is string => typeof option === "string"))
      : undefined,
    outline: turn.kind === "outline" ? turn.outline : undefined,
  };
}

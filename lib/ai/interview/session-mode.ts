import { z } from "zod";

export const InterviewSessionModeSchema = z.enum(["natural", "structured"]);

export type InterviewSessionMode = z.infer<typeof InterviewSessionModeSchema>;

export const DEFAULT_INTERVIEW_SESSION_MODE: InterviewSessionMode = "natural";

export interface InterviewSessionModeOption {
  value: InterviewSessionMode;
  label: string;
  description: string;
}

export const INTERVIEW_SESSION_MODE_OPTIONS: InterviewSessionModeOption[] = [
  {
    value: "natural",
    label: "自然访谈",
    description: "更像自由对话，边聊边收束方向。",
  },
  {
    value: "structured",
    label: "结构化访谈",
    description: "代码先定策略，再自然提问和生成大纲。",
  },
];

export function normalizeInterviewSessionMode(
  value: string | null | undefined,
): InterviewSessionMode {
  const parsed = InterviewSessionModeSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_INTERVIEW_SESSION_MODE;
}

export function getInterviewSessionModeLabel(mode: InterviewSessionMode): string {
  return (
    INTERVIEW_SESSION_MODE_OPTIONS.find((option) => option.value === mode)?.label ??
    INTERVIEW_SESSION_MODE_OPTIONS[0].label
  );
}

export function getInterviewSessionModeDescription(mode: InterviewSessionMode): string {
  return (
    INTERVIEW_SESSION_MODE_OPTIONS.find((option) => option.value === mode)?.description ??
    INTERVIEW_SESSION_MODE_OPTIONS[0].description
  );
}

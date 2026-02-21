import { z } from "zod";

// ============================================
// LearnerProfile — AI 自主填充的学习者画像
// ============================================

export const LearnerProfileSchema = z.object({
  // 核心维度（nullable, AI 按需填充）
  goal: z.string().nullable().default(null),
  background: z.string().nullable().default(null),
  targetOutcome: z.string().nullable().default(null),
  constraints: z.string().nullable().default(null),
  preferences: z.string().nullable().default(null),

  // AI 推断的元信息
  domain: z.string().nullable().default(null),
  domainComplexity: z
    .enum(["trivial", "simple", "moderate", "complex", "expert"])
    .nullable()
    .default(null),
  goalClarity: z.enum(["vague", "clear", "precise"]).nullable().default(null),
  backgroundLevel: z
    .enum(["none", "beginner", "intermediate", "advanced"])
    .nullable()
    .default(null),

  // 自由洞察（追加式）
  insights: z.array(z.string()).default([]),

  // 就绪度
  readiness: z.number().min(0).max(100).default(0),
  missingInfo: z.array(z.string()).default([]),
});

export type LearnerProfile = z.infer<typeof LearnerProfileSchema>;

export const EMPTY_PROFILE: LearnerProfile = LearnerProfileSchema.parse({});

// ============================================
// updateProfile 工具输入 Schema
// ============================================

export const UpdateProfileInputSchema = z.object({
  updates: z.object({
    goal: z.string().nullish(),
    background: z.string().nullish(),
    targetOutcome: z.string().nullish(),
    constraints: z.string().nullish(),
    preferences: z.string().nullish(),
    domain: z.string().nullish(),
    domainComplexity: z.enum(["trivial", "simple", "moderate", "complex", "expert"]).nullish(),
    goalClarity: z.enum(["vague", "clear", "precise"]).nullish(),
    backgroundLevel: z.enum(["none", "beginner", "intermediate", "advanced"]).nullish(),
    insights: z.array(z.string()).nullish(),
    readiness: z.number().min(0).max(100),
    missingInfo: z.array(z.string()),
  }),
});

// ============================================
// suggestOptions 工具输入 Schema
// ============================================

export const SuggestOptionsSchema = z.object({
  options: z
    .array(z.string())
    .min(2)
    .max(5)
    .describe("根据当前话题动态生成的 2-5 个选项，用户可选可不选"),
});

// ============================================
// proposeOutline 工具输入 Schema
// ============================================

export const ProposeOutlineSchema = z.object({
  summary: z.string().describe("对用户需求的一段话总结"),
  suggestedTitle: z.string().describe("建议的课程标题"),
});

// ============================================
// Interview Session 状态
// ============================================

export type InterviewStatus =
  | "interviewing"
  | "proposing"
  | "confirmed"
  | "generating"
  | "completed";

// 前端 Phase（从 InterviewStatus 映射）
export type InterviewPhase =
  | "interviewing"
  | "proposing"
  | "reviewing"
  | "generating"
  | "completed";

// 前端组件 Props 类型（保留兼容）
export interface OptionButtonsProps {
  options: string[];
  onSelect: (val: string) => void;
  disabled: boolean;
}

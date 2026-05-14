import { z } from "zod";

export const AIRouteProfileSchema = z.enum(["platform", "domestic", "gemini", "openai"]);

export type AIRouteProfile = z.infer<typeof AIRouteProfileSchema>;

export const DEFAULT_AI_ROUTE_PROFILE: AIRouteProfile = "platform";

export interface AIRouteProfileOption {
  value: AIRouteProfile;
  label: string;
  description: string;
}

export const AI_ROUTE_PROFILE_OPTIONS: AIRouteProfileOption[] = [
  {
    value: "platform",
    label: "平台推荐",
    description: "按 NexusNote 当前任务路由选择模型。",
  },
  {
    value: "domestic",
    label: "国产链路",
    description: "前台学习体验优先走国产模型。",
  },
  {
    value: "gemini",
    label: "Gemini 链路",
    description: "前台对话、访谈、蓝图和章节生成走 Gemini 组合。",
  },
  {
    value: "openai",
    label: "OpenAI 链路",
    description: "前台学习体验统一走 OpenAI 组合。",
  },
];

export function normalizeAIRouteProfile(value: unknown): AIRouteProfile {
  const parsed = AIRouteProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_AI_ROUTE_PROFILE;
}

export const AI_CAPABILITIES = {
  basicChat: "basic_chat",
  courseGeneration: "course_generation",
  research: "research",
} as const;

export type AICapability = (typeof AI_CAPABILITIES)[keyof typeof AI_CAPABILITIES];

export const FREE_RESEARCH_WEEKLY_LIMIT = 3;
export const FREE_COURSE_GENERATION_LIFETIME_LIMIT = 1;

export const CAPABILITY_ACCESS = {
  [AI_CAPABILITIES.basicChat]: "free",
  [AI_CAPABILITIES.courseGeneration]: "metered_free",
  [AI_CAPABILITIES.research]: "metered_free",
} as const satisfies Record<AICapability, "free" | "metered_free" | "entitlement">;

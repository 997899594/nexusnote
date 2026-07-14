export const AI_CAPABILITIES = {
  basicChat: "basic_chat",
  courseGeneration: "course_generation",
  research: "research",
} as const;

export type AICapability = (typeof AI_CAPABILITIES)[keyof typeof AI_CAPABILITIES];

export const CAPABILITY_ACCESS = {
  [AI_CAPABILITIES.basicChat]: "free",
  [AI_CAPABILITIES.courseGeneration]: "entitlement",
  [AI_CAPABILITIES.research]: "entitlement",
} as const satisfies Record<AICapability, "free" | "entitlement">;

export function requiresEntitlement(capability: AICapability): boolean {
  return CAPABILITY_ACCESS[capability] === "entitlement";
}

import { AI_CAPABILITIES, type AICapability } from "./capabilities";

const CAPABILITY_LIMIT_ERRORS = {
  [AI_CAPABILITIES.research]: {
    code: "RESEARCH_WEEKLY_LIMIT_REACHED",
    message: "本周 3 次免费 Research 已用完，下周一自动恢复；升级 Pro 可无限使用",
  },
  [AI_CAPABILITIES.courseGeneration]: {
    code: "COURSE_GENERATION_FREE_LIMIT_REACHED",
    message: "免费完整课程生成额度已使用；升级 Pro 可继续创建课程",
  },
} as const;

export class CapabilityAllowanceExceededError extends Error {
  readonly code: string;

  constructor(readonly capability: AICapability) {
    const error =
      capability in CAPABILITY_LIMIT_ERRORS
        ? CAPABILITY_LIMIT_ERRORS[capability as keyof typeof CAPABILITY_LIMIT_ERRORS]
        : {
            code: "AI_CAPABILITY_LIMIT_REACHED",
            message: "当前 AI 能力的免费额度已用完",
          };

    super(error.message);
    this.name = "CapabilityAllowanceExceededError";
    this.code = error.code;
  }
}

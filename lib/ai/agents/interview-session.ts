import {
  DEFAULT_INTERVIEW_SESSION_MODE,
  type InterviewSessionMode,
  normalizeInterviewSessionMode,
} from "@/lib/ai/interview";
import type { InterviewAgentOptions } from "./interview";
import { createInterviewAgent } from "./interview";
import { createStructuredInterviewAgent } from "./interview-structured";

export interface InterviewSessionAgentOptions extends InterviewAgentOptions {
  mode?: InterviewSessionMode;
}

export async function createInterviewSessionAgent(options: InterviewSessionAgentOptions) {
  const mode = normalizeInterviewSessionMode(options.mode ?? DEFAULT_INTERVIEW_SESSION_MODE);

  if (mode === "structured") {
    return createStructuredInterviewAgent(options);
  }

  return createInterviewAgent(options);
}

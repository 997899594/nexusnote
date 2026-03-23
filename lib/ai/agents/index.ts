/**
 * AI Agents - Factory
 */

import type { AgentProfile } from "../core/capability-profiles";
import { createChatAgent, type PersonalizationOptions } from "./chat";
import { createInterviewAgent, type InterviewAgentOptions } from "./interview";

// ============================================
// Types
// ============================================

export type { AgentProfile };

export type { PersonalizationOptions, InterviewAgentOptions };

// ============================================
// Factory
// ============================================

type AgentOptions = PersonalizationOptions & Partial<InterviewAgentOptions>;

export async function getAgent(profile: AgentProfile, options: AgentOptions = {}) {
  switch (profile) {
    case "INTERVIEW":
      return createInterviewAgent(options as InterviewAgentOptions);
    default:
      return await createChatAgent({ ...options, profile });
  }
}

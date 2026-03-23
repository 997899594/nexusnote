/**
 * AI Agents - Factory
 */

import { createChatAgent, type PersonalizationOptions } from "./chat";
import { createInterviewAgent, type InterviewAgentOptions } from "./interview";
import { createSkillsAgent, type SkillsAgentOptions } from "./skills";

// ============================================
// Types
// ============================================

export type AgentIntent = "CHAT" | "INTERVIEW" | "SKILLS";

export type { PersonalizationOptions, InterviewAgentOptions, SkillsAgentOptions };

// ============================================
// Factory
// ============================================

type AgentOptions = PersonalizationOptions &
  Partial<InterviewAgentOptions> &
  Partial<SkillsAgentOptions>;

export async function getAgent(intent: AgentIntent, options: AgentOptions = {}) {
  switch (intent) {
    case "INTERVIEW":
      return createInterviewAgent(options as InterviewAgentOptions);
    case "SKILLS": {
      if (!options.userId) throw new Error("Skills agent requires userId");
      return createSkillsAgent(options as SkillsAgentOptions);
    }
    default:
      return await createChatAgent(options);
  }
}

/**
 * AI Agents - Factory
 */

import { createChatAgent, type PersonalizationOptions } from "./chat";
import { createCourseAgent } from "./course";
import { createInterviewAgent, type InterviewOptions } from "./interview";
import { createSkillsAgent, type SkillsAgentOptions } from "./skills";

// ============================================
// Types
// ============================================

export type AgentIntent = "CHAT" | "INTERVIEW" | "COURSE" | "SKILLS";

export type { PersonalizationOptions, InterviewOptions, SkillsAgentOptions };

// ============================================
// Factory
// ============================================

type AgentOptions = PersonalizationOptions & Partial<InterviewOptions> & Partial<SkillsAgentOptions>;

export function getAgent(intent: AgentIntent, options: AgentOptions = {}) {
  switch (intent) {
    case "INTERVIEW":
      return createInterviewAgent(options as InterviewOptions);
    case "COURSE":
      return createCourseAgent(options);
    case "SKILLS": {
      if (!options.userId) return createChatAgent(options);
      return createSkillsAgent(options as SkillsAgentOptions);
    }
    default:
      return createChatAgent(options);
  }
}

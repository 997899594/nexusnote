/**
 * AI Agents - Factory
 */

import type { AgentProfile } from "../core/capability-profiles";
import { createChatAgent, type PersonalizationOptions } from "./chat";

// ============================================
// Types
// ============================================

export type { AgentProfile };

export type { PersonalizationOptions };

// ============================================
// Factory
// ============================================

type AgentOptions = PersonalizationOptions;

export async function getAgent(profile: AgentProfile, options: AgentOptions = {}) {
  return await createChatAgent({ ...options, profile });
}

/**
 * AI Agents - Factory
 *
 * 统一的 Agent 创建入口
 */

import { createChatAgent, type PersonalizationOptions } from "./chat";
import { createInterviewAgent, type InterviewOptions } from "./interview";
import { createCourseAgent } from "./course";
import { createSkillsAgent } from "./skills";

// ============================================
// Types
// ============================================

/**
 * Agent 意图类型
 * - CHAT: 通用对话 (默认)
 * - INTERVIEW: 学习访谈 (需要 courseProfileId)
 * - COURSE: 课程生成
 * - SKILLS: 技能发现
 * - EDITOR/SEARCH: 已弃用，映射到 CHAT
 */
export type AgentIntent = "CHAT" | "INTERVIEW" | "COURSE" | "SKILLS" | "EDITOR" | "SEARCH";

export type { PersonalizationOptions, InterviewOptions };

// ============================================
// Factory
// ============================================

/**
 * 获取 Agent 实例
 *
 * @param intent - Agent 类型
 * @param options - Agent 配置
 */
export function getAgent(
  intent: AgentIntent,
  options?: PersonalizationOptions | InterviewOptions,
) {
  switch (intent) {
    case "INTERVIEW": {
      return createInterviewAgent(options as InterviewOptions);
    }
    case "COURSE":
      return createCourseAgent(options as PersonalizationOptions | undefined);
    case "SKILLS":
      return createSkillsAgent(options as PersonalizationOptions | undefined);
    default:
      return createChatAgent(options as PersonalizationOptions | undefined);
  }
}

/**
 * AI Agents - Factory
 *
 * 统一的 Agent 创建入口
 */

import { createChatAgent, type PersonalizationOptions } from "./chat";
import { createCourseAgent } from "./course";
import { createInterviewAgent, type InterviewOptions } from "./interview";
import { createSkillsAgent, type SkillsAgentOptions } from "./skills";

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

export type { PersonalizationOptions, InterviewOptions, SkillsAgentOptions };

// ============================================
// Factory
// ============================================

/**
 * 获取 Agent 实例
 *
 * @param intent - Agent 类型
 * @param options - Agent 配置
 */
export function getAgent(intent: AgentIntent, options?: PersonalizationOptions | InterviewOptions | SkillsAgentOptions) {
  switch (intent) {
    case "INTERVIEW": {
      return createInterviewAgent(options as InterviewOptions);
    }
    case "COURSE":
      return createCourseAgent(options as PersonalizationOptions | undefined);
    case "SKILLS": {
      const personalization = options as PersonalizationOptions | undefined;
      // SKILLS agent 需要 userId
      const userId = (options as Record<string, unknown>)?.userId as string | undefined;
      if (!userId) {
        // 如果没有 userId，回退到 chat agent
        return createChatAgent(personalization);
      }
      return createSkillsAgent({
        ...personalization,
        userId,
      });
    }
    default:
      return createChatAgent(options as PersonalizationOptions | undefined);
  }
}

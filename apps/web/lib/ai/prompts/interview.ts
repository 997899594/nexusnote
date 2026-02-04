/**
 * Interview Prompt Builder - 动态 Prompt 工厂
 * NexusNote 2026 Architecture
 *
 * 核心理念：
 * 1. 代码掌舵，AI 划桨 - 业务逻辑由代码控制，对话由 AI 生成
 * 2. 隐式状态机 - 基于数据缺口驱动流程，不维护复杂的 State Enum
 * 3. 单维度锁定 - 每次只解决一个问题，防止 AI 抢跑
 */

import { EDGE_CASE_HANDLERS } from "./edge-cases";

export interface InterviewContext {
  goal?: string;
  background?: string;
  time?: string;
  targetOutcome?: string;
  cognitiveStyle?: string;
  level?: string;
  levelDescription?: string;
}

/**
 * L1: Context Analysis + Prompt Injection
 * 根据数据缺口动态组装 System Prompt
 */
export function buildInterviewPrompt(context: InterviewContext): string {
  // 基础人设（不变部分）
  const BASE_PERSONA = `课程导师。温暖专业。收集目标、背景、时间，生成课程。对话为主，选项为辅。`;

  // 动态任务注入（根据数据缺口）
  const TASK = injectTaskByPhase(context);

  return `${BASE_PERSONA}\n\n${TASK}`;
}

/**
 * 根据上下文缺口注入不同的战术指令
 * 这是"隐式状态机"的核心实现
 */
function injectTaskByPhase(context: InterviewContext): string {
  const hasGoal = Boolean(context.goal);
  const hasBackground = Boolean(context.background);
  const hasTime = Boolean(context.time);

  // Phase 1: 收集目标
  if (!hasGoal) {
    //     return `缺: 学习目标
    // 说明后，必须调用 presentOptions 提供选项。
    // 例: "Python不错！你想往哪个方向？[然后调用 presentOptions]"`;
    return `你的目的是收集用户的学习目标，必须调用 presentOptions 提供选项。
例: "Python不错！你想往哪个方向？[然后调用 presentOptions]"`;
  }

  // Phase 2: 收集背景
  if (!hasBackground) {
    return `缺: 学习背景（针对 ${context.goal}）
说明后，必须调用 presentOptions 提供选项。
例: "明白了！你之前有接触过吗？[然后调用 presentOptions]"`;
  }

  // Phase 3: 收集时间
  if (!hasTime) {
    return `缺: 可用时间
说明后，必须调用 presentOptions 提供选项。
例: "每周能花多少时间？[然后调用 presentOptions]"`;
  }

  // Phase 4: 信息完整，准备生成
  return `信息已齐: 目标=${context.goal}, 背景=${context.background}, 时间=${context.time}
直接调用 generateOutline 生成课程大纲。`;
}

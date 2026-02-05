/**
 * Interview Prompt Builder - 动态 Prompt 工厂
 * NexusNote 2026 Architecture
 *
 * 核心理念：
 * 1. 代码掌舵，AI 划桨 - 业务逻辑由代码控制，对话由 AI 生成
 * 2. 隐式状态机 - 基于数据缺口驱动流程，不维护复杂的 State Enum
 * 3. 单维度锁定 - 每次只解决一个问题，防止 AI 抢跑
 */

import type { InterviewContext } from "@/lib/ai/agents/interview/agent";

/**
 * L1: Context Analysis + Prompt Injection
 * 根据数据缺口动态组装 System Prompt
 */
export function buildInterviewPrompt(context: InterviewContext): string {
  // 基础人设（不变部分）
  const BASE_PERSONA = `课程导师。温暖专业。收集学习目标、背景、预期成果、学习风格，生成课程。对话为主，选项为辅。`;

  // 动态任务注入（根据数据缺口）
  const TASK = injectTaskByPhase(context);

  return `${BASE_PERSONA}\n\n${TASK}`;
}

/**
 * 根据上下文缺口注入不同的战术指令
 * 这是"隐式状态机"的核心实现
 *
 * 4 个维度的收集顺序：
 * Phase 1: Goal (学什么)
 * Phase 2: Background (基础如何)
 * Phase 3: TargetOutcome (为了什么)
 * Phase 4: CognitiveStyle (怎么学)
 */
function injectTaskByPhase(context: InterviewContext): string {
  const hasGoal = Boolean(context.goal);
  const hasBackground = Boolean(context.background);
  const hasTargetOutcome = Boolean(context.targetOutcome);
  const hasCognitiveStyle = Boolean(context.cognitiveStyle);

  // Phase 1: 收集目标
  if (!hasGoal) {
    return `了解用户真实的学习目标，必须调用 presentOptions 提供选项。
例: "Python不错！你想往哪个方向？[然后调用 presentOptions]"`;
  }

  // Phase 2: 收集背景
  if (!hasBackground) {
    return `了解用户的相关背景（针对 ${context.goal}），必须调用 presentOptions 提供选项。
例: "明白了！你之前有接触过吗？[然后调用 presentOptions]"`;
  }

  // Phase 3: 收集预期成果
  if (!hasTargetOutcome) {
    return `了解用户的预期成果（针对 ${context.goal}），必须调用 presentOptions 提供选项。
例: "学完想做什么项目？[然后调用 presentOptions]"`;
  }

  // Phase 4: 收集认知风格
  if (!hasCognitiveStyle) {
    return `了解用户的学习风格（针对 ${context.goal} 领域），必须调用 presentOptions 提供选项。
例: "你更喜欢哪种学习方式？[然后调用 presentOptions]"
注意：根据领域灵活生成选项（技术类：实战/原理/类比；艺术类：模仿/理论/实验）`;
  }

  // Phase 5: 信息完整，准备生成
  return `信息已齐: 目标=${context.goal}, 背景=${context.background}, 成果=${context.targetOutcome}, 风格=${context.cognitiveStyle}
直接调用 generateOutline 生成课程大纲。`;
}

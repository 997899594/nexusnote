/**
 * Interview Prompt Builder - 动态 Prompt 工厂
 * NexusNote 2026 Architecture
 *
 * 核心理念：
 * 1. 代码掌舵，AI 划桨 - 业务逻辑由代码控制，对话由 AI 生成
 * 2. 隐式状态机 - 基于数据缺口驱动流程，不维护复杂的 State Enum
 * 3. 单维度锁定 - 每次只解决一个问题，防止 AI 抢跑
 */

import { EDGE_CASE_HANDLERS } from './edge-cases';

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
  const BASE_PERSONA = `你是 NexusNote 课程顾问，帮助用户规划学习路径。`;

  // 动态任务注入（根据数据缺口）
  const TASK = injectTaskByPhase(context);

  return `${BASE_PERSONA}\n\n${TASK}`;
}

/**
 * 根据上下文缺口注入不同的战术指令
 * 这是"隐式状态机"的核心实现
 */
function injectTaskByPhase(context: InterviewContext): string {
  // 阶段检测
  const hasGoal = Boolean(context.goal);
  const hasBackground = Boolean(context.background);
  const hasTime = Boolean(context.time);

  // 进度展示
  const progress = `
## 📊 当前收集进度

${hasGoal ? '✅' : '⏳'} **学习目标**${hasGoal ? `: ${context.goal}` : '（待确认）'}
${hasBackground ? '✅' : '⏳'} **学习背景**${hasBackground ? `: ${context.background}` : '（待确认）'}
${hasTime ? '✅' : '⏳'} **可用时间**${hasTime ? `: ${context.time}` : '（待确认）'}
  `.trim();

  // Phase 1: 收集目标
  if (!hasGoal) {
    return `
${progress}

当前任务：了解用户的学习目标。

与用户简短对话后，调用 presentOptions 工具展示选项。例如用户说"我想学编程"，你可以：

1. 回复文字："很好！编程领域很广阔，让我帮您明确方向。"
2. 调用工具：presentOptions({question: "选择方向", options: ["Web开发", "移动开发", "数据科学", "AI开发"], targetField: "goal"})
    `.trim();
  }

  // Phase 2: 收集背景
  if (!hasBackground) {
    return `
${progress}

当前任务：了解用户的学习背景（针对 ${context.goal}）。

与用户对话，然后调用 presentOptions。例如：

1. 回复文字："明白了，${context.goal}。您目前的水平如何？"
2. 调用工具：presentOptions({question: "您的水平", options: ["零基础", "有基础", "有经验", "专业级"], targetField: "background"})
    `.trim();
  }

  // Phase 3: 收集时间
  if (!hasTime) {
    return `
${progress}

当前任务：了解用户的时间投入。

与用户对话，然后调用 presentOptions。例如：

1. 回复文字："好的！您每周能投入多少时间学习？"
2. 调用工具：presentOptions({question: "每周学习时间", options: ["每周5小时", "每周10小时", "每周20+小时", "全职学习"], targetField: "time", allowSkip: true})
    `.trim();
  }

  // Phase 4: 信息完整，准备生成
  return `
${progress}

当前任务：确认信息并生成课程大纲。

基于收集的信息（${context.goal}・${context.background}・${context.time}），向用户确认是否生成大纲。

1. 回复文字："完美！我们已经了解了您的情况。"
2. 调用工具：presentOptions({question: "准备好了吗？", options: ["生成课程大纲", "修改需求"], targetField: "general"})

如果用户选择"生成课程大纲"，调用 generateOutline 工具生成完整方案。
  `.trim();
}

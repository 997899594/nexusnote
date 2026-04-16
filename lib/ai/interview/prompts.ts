import { loadPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  formatGrowthGenerationContext,
  type GrowthGenerationContext,
} from "@/lib/growth/generation-context-format";
import type { InterviewOutline } from "./schemas";

const NATURAL_INTERVIEW_SYSTEM_PROMPT = loadPromptResource("interview-system.md");

function hasPattern(value: string | undefined, pattern: RegExp) {
  return typeof value === "string" && pattern.test(value);
}

function buildFirstTurnHint(latestUserMessage?: string) {
  if (!latestUserMessage) {
    return "";
  }

  const normalized = latestUserMessage.replace(/\s+/g, "");
  const mentionsTopic =
    normalized.includes("学") ||
    normalized.includes("做") ||
    normalized.includes("准备") ||
    normalized.includes("练") ||
    normalized.includes("提升");
  const mentionsOutcome = hasPattern(
    normalized,
    /想(达到|做到|完成|应对|解决)|希望|目标|为了|用来|拿下|通过|上手|独立/,
  );
  const mentionsBaseline = hasPattern(
    normalized,
    /零基础|有基础|做过|学过|会一点|接触过|熟悉|正在做|有经验/,
  );
  const mentionsConstraints = hasPattern(
    normalized,
    /两周|一个月|三个月|业余|周末|时间不多|尽快|考试|汇报|工作|副业|预算|只想/,
  );

  if (mentionsTopic && mentionsOutcome && mentionsBaseline) {
    return `\n首轮引导：
- 用户已经同时给出了学习主题、目标结果和当前基础，不要再重复确认这三项
- 优先补足真正影响课程设计的最后一个关键约束，例如时间、应用场景、深度范围，或者直接进入课程草案预览
- 如果当前信息已经足够组成一门像样的课，就不要为了凑轮次继续追问`;
  }

  if (mentionsTopic && mentionsOutcome) {
    return `\n首轮引导：
- 用户已经说清楚学什么和想达到什么结果，不要再把它们换句话术重问一遍
- 下一问优先补足当前基础或关键约束，而不是回到泛泛目标确认`;
  }

  if (mentionsTopic && !mentionsOutcome) {
    return `\n首轮引导：
- 用户已经说清楚想学什么，不要重复确认主题
- 下一问优先问“学完想达到什么结果”或“准备用在什么场景”，不要先默认技术基础`;
  }

  if (mentionsConstraints && !mentionsTopic) {
    return `\n首轮引导：
- 用户先说了时间或场景约束，但主题还不清楚
- 下一问优先帮用户收敛具体学习主题，不要一次追问多个维度`;
  }

  return "";
}

export function buildNaturalInterviewAgentInstructions(input: {
  currentOutline?: InterviewOutline;
  latestUserMessage?: string;
  preferOutlinePreview?: boolean;
  generationContext?: GrowthGenerationContext;
}) {
  const firstTurnHint = buildFirstTurnHint(input.latestUserMessage);

  return `${NATURAL_INTERVIEW_SYSTEM_PROMPT}

你的职责是通过几轮简洁对话，帮用户澄清学习方向，并在信息足够时切换到课程草案预览。

必须遵守：
- 每轮只推进一个关键问题，不要同时追问多个维度
- 普通回复使用自然中文，直接对用户说话
- 不要输出思考过程
- 优先复用用户已经明确给出的信息，不要重复追问已说清楚的主题、目标、基础或修改意图
- 每轮都必须调用一个展示类工具
- 继续澄清时调用 presentOptions，提供 2 到 4 个简洁、可点击的中文选项
- 进入课程草案预览时调用 presentOutlinePreview，并返回完整 outline 与下一步动作选项
- 不要在正文里逐条重复这些选项；选项通过工具单独返回
- 如果已有大纲，用户提出修改时，优先在现有大纲上调整，而不是从头重新访谈
- 当你调用 presentOutlinePreview 时，正文应简短确认你理解的方向或修改意图，不要再追加新的追问

访谈原则：
- 这是全领域课程访谈，不默认用户学的是技术主题
- 主题可能是职业技能、考试准备、表达能力、创作技能、生活技能、管理方法或兴趣学习
- 通常 2 到 5 轮完成，不要拖沓
- 信息不够时继续追问，但不要机械盘问
- 信息够用时及时推进到课程草案预览
- 如果用户已经明确说出“学什么 + 想达到什么结果”，下一问优先补足基础、约束或应用场景，不要重复确认目标
- 如果用户已经明确说明主题、主要目标或修改意图，不要重复确认同一信息；下一问只补一个真正影响课程设计的缺口
- 不要把用户已经说过的话换一种说法再问一遍；每一轮都要带来新的信息增量
- 如果用户已经给出明确主题、当前基础和具体结果，优先考虑直接给出课程草案预览
- 当用户准备修改已有大纲时，options 应切换成修改或下一步动作，例如“补基础章节”“增加案例练习”“调整章节顺序”“开始生成课程”

大纲要求：
- 课程草案预览就是可判断价值的完整课程蓝图，不能只给骨架
- 预览阶段就应返回课程简介、目标受众、学习成果、章节说明和小节说明
- 预览阶段还必须返回 courseSkillIds 和每章的 skillIds，作为后续学习结构化基础
- 默认结构基线是 5 到 7 章、每章 4 到 6 个小节；除非用户明确要求更短更长，才偏离这个基线
- 课程标题和章节标题优先简短具体，不要写口号式修饰
- 所有能力字段使用简洁稳定的中文或英文能力标签，不要使用空泛词

${input.currentOutline ? `当前已有课程大纲，请优先围绕它做修改与完善：\n${JSON.stringify(input.currentOutline, null, 2)}` : "当前还没有课程大纲。"}

当前成长上下文：
${formatGrowthGenerationContext(input.generationContext, { style: "detailed" })}${firstTurnHint}
${
  input.preferOutlinePreview
    ? `

本轮额外要求：
- 这轮优先直接给出课程草案预览，而不是继续追问抽象问题
- options 控制在 3 到 4 个，优先给短动作词，例如“补基础章节”“增加案例练习”“调整项目方向”“开始生成课程”
`
    : ""
}
${
  input.currentOutline
    ? `

已有大纲时的特殊规则：
- 默认把本轮理解为修改大纲，而不是重新做需求访谈
- 默认优先调用 presentOutlinePreview
- 更新版大纲应保持完整结构，而不是只改几个标题
- 只有当用户请求仍然模糊到无法直接改结构时，才允许继续追问，并改用 presentOptions
`
    : ""
}
`;
}

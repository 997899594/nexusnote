/**
 * Interview Agent - 课程访谈 Agent
 *
 * 使用 AI SDK v6 ToolLoopAgent 定义课程规划访谈代理
 * 两种模式：访谈采集需求 / 大纲修订
 */

import {
  ToolLoopAgent,
  InferAgentUIMessage,
  smoothStream,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { chatModel } from "@/lib/ai/registry";
import { interviewSkills } from "@/lib/ai/skills/interview";

const InterviewCallOptionsSchema = z.object({
  phase: z.string().optional(),
  currentOutline: z.unknown().optional(),
  goal: z.string().optional(),
  currentProfile: z.unknown().optional(),
});

export type InterviewCallOptions = z.infer<typeof InterviewCallOptionsSchema>;

export const interviewAgent = new ToolLoopAgent({
  id: "nexusnote-interview",
  model: chatModel!,
  tools: interviewSkills,
  callOptionsSchema: InterviewCallOptionsSchema,
  stopWhen: stepCountIs(3),

  prepareCall: ({ options, ...rest }) => {
    const callOptions = (options ?? {}) as InterviewCallOptions;
    const { phase, currentOutline, goal, currentProfile } = callOptions;

    let instructions: string;
    let temperature: number;

    if (phase === "outline_review" && currentOutline) {
      temperature = 0.2;
      instructions = `你现在是**课程架构师**。
用户正在审查大纲并提出修改意见。

【当前大纲上下文】
\`\`\`json
${JSON.stringify(currentOutline)}
\`\`\`

**任务**：
1. 理解用户的修改意图。
2. 调用 \`updateOutline\` 工具执行修改。
3. 如果用户确认无误，调用 \`confirmCourse\` 工具。

**注意**：直接执行修改，并简要说明改了什么。`;
    } else {
      temperature = 0.5;
      instructions = `你是一位追求极致效率的"首席课程顾问"。
用户目标："${goal || "未定义"}"。
风格：专业、引导性强、节奏感好。

### 核心交互原则
1. **对话为主，选项为辅**：
   - **自然语言是第一交互方式**。你的主要任务是**引导对话**，让用户说出想法。
   - **选项仅作为"快捷输入"**。不要依赖用户点击选项。如果用户在对话中直接回答了问题（比如直接说"我要学高级内容"），就**不需要**再展示该维度的选项。
   - 只有当用户可能不知道怎么回答，或者为了降低输入成本时，才提供 \`presentOptions\`。

### ⚠️ 绝对红线 (Zero Tolerance)
1. **单一变量原则**：每一次回复，**只能**确认 **1 个** 未知维度。
   - ❌ 错误： "你的行业是什么？想学多久？" (一次问俩，死刑)
   - ✅ 正确： "你的目标行业是？" (等用户回了再问下一个)
2. **禁止脑补**：如果用户的回答模糊（比如只说了数字），**不要**假设含义。直接反问 "请问这 '10' 指的是您的从业经验，还是其他意思？"
3. **禁止替用户回答**：严禁模拟用户说话（如"OK"、"我选第一个"）。你的回复必须在提出问题或给出选项后**立即停止**。
4. **禁止单词回复**：你的每一次回复必须是**完整的句子**。绝对禁止只输出像"运动"、"好的"、"AI"这样的单词。

### 交互策略
1. **NextQuestion**: 针对当前最缺失的一个维度（行业 OR 时长，**二选一，绝不双选**），提出问题。
2. **灵活使用工具**：
   - 收集到用户画像信息 (难度、时长等) -> 调用 \`updateProfile\`。
   - 仅在需要提供**快捷建议**时 -> 调用 \`presentOptions\`。**注意：优先使用单维度选项。只有当两个维度紧密相关（如"方向"和"子方向"）时才使用 \`optionGroups\` 分组展示。**
   - 收集足够信息，准备生成大纲 -> 调用 \`generateOutline\`。

状态注入: ${JSON.stringify(currentProfile || {})}`;
    }

    return {
      ...rest,
      instructions,
      temperature,
    };
  },
});

export type InterviewAgentMessage = InferAgentUIMessage<typeof interviewAgent>;

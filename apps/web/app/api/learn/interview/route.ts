import { streamText, Output } from "ai";
import { z } from "zod";
import { chatModel, isAIConfigured, getAIProviderInfo } from "@/lib/ai";
import { interviewSchema } from "@/lib/schemas/interview"; // 确保这里引用的是上面修改过的文件

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { goal, history, currentProfile, phase, currentOutline } =
    await req.json();

  if (!isAIConfigured() || !chatModel) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    );
  }

  try {
    const messages: any[] = [];
    let systemPrompt = "";
    // ✅ 修复3: 动态温度
    let currentTemperature = 0.7;

    // === 模式 A: 大纲修订 ===
    if (phase === "outline_review" && currentOutline) {
      currentTemperature = 0.2; // 🧊 降温，保证 JSON 修改的精确性

      // 填充历史对话
      if (history?.length > 0) {
        history.forEach((h: { q: string; a: string }) => {
          messages.push({ role: "assistant", content: h.q });
          messages.push({ role: "user", content: h.a });
        });
      }

      // ✅ 修复2: 干净的上下文注入
      // 不要在 messages 里 unshift system，直接写进 systemPrompt 字符串
      systemPrompt = `你现在是**课程架构师**。
用户正在审查大纲并提出修改意见。

【当前大纲上下文】
\`\`\`json
${JSON.stringify(currentOutline)}
\`\`\`

**任务**：
1. 理解用户的修改意图。
2. 基于【当前大纲上下文】执行修改。
3. **必须**将修改后的完整 JSON 返回到 \`revisedOutline\` 字段。
4. 在 \`feedback\` 中简述修改内容。

**注意**：不要进入访谈模式，直接执行修改指令。`;
    }
    // === 模式 B: 访谈模式 ===
    else {
      currentTemperature = 0.7; // 🔥 升温，保证对话自然

      if (history?.length > 0) {
        history.forEach((h: { q: string; a: string }) => {
          messages.push({ role: "assistant", content: h.q });
          messages.push({ role: "user", content: h.a });
        });
      } else {
        // 冷启动
        messages.push({
          role: "user",
          content: `(系统指令) 用户目标：【${goal}】。
你现在是**首席课程顾问**。摒弃寒暄，保持职业冷静。
1. Feedback: 确认需求。
2. NextQuestion: 抛出技术/业务分流问题。`,
        });
      }

      systemPrompt = `你是一位追求极致效率的"首席课程顾问"。
用户目标："${goal}"。
风格：高信噪比、零废话。

### 🎭 开场策略 (Direct & Professional)
如果是第一轮对话：
- **Feedback**: 仅确认领域范围，不带感情色彩。
- **NextQuestion**: 基于专业分类的二选一/多选一。

### 🚫 禁忌 (Critical Constraints)
1. **禁止比喻**：不要说"代码是魔法"、"数据的海洋"。
2. **禁止过度礼貌**：不需要"请问"、"谢谢"，直接问问题。
3. **禁止模糊**：不要用"认知程度"，用"实战经验"、"技术栈"、"业务场景"。
4. **禁止复读 UI**：文本里不要包含选项内容。

### 🧠 深度推理与策略 (Deduction & Strategy)
利用 \`analysis\` 字段进行"思维链"推导：
1. **冲突检测**：检查用户回答是否推翻了 \`Current Profile\`？
2. **信息提取**：从字里行间提取 Prior Knowledge（背景）和 Cognitive Style（风格）。
3. **决策路径**：
   - 还没搞清方向？ -> **Ask** (提出分流问题)。
   - 方向明确但细节模糊？ -> **Suggest** (提供 UI 选项引导)。
   - 要素齐全 (Level, Outcome, Time)? -> **Finish** (完成画像)。

状态注入: ${JSON.stringify(currentProfile || {})}`;
    }

    const result = streamText({
      model: chatModel,
      temperature: currentTemperature, // 使用动态温度
      output: Output.object({
        schema: interviewSchema,
      }),
      system: systemPrompt,
      messages,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Interview API Error:", error);
    return Response.json(
      { error: "Failed to generate interview response" },
      { status: 500 },
    );
  }
}

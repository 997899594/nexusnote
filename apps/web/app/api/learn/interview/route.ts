import { streamText, Output } from "ai";
import { z } from "zod";
import { chatModel, isAIConfigured, getAIProviderInfo } from "@/lib/ai";
import { interviewSchema } from "@/lib/schemas/interview";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { goal, history, currentProfile } = await req.json();

  if (!isAIConfigured() || !chatModel) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 },
    );
  }

  try {
    // 构造标准的 Chat Messages 结构 (解决 Ventriloquist Anti-Pattern)
    const messages: any[] = [];

    if (history && history.length > 0) {
      history.forEach((h: { q: string; a: string }) => {
        messages.push({ role: "assistant", content: h.q });
        messages.push({ role: "user", content: h.a });
      });
    } else {
      // 冷启动处理 (Cold Start Handling)
      // 如果没有历史记录，模拟一个系统触发的用户指令，让 AI 开始访谈
      messages.push({
        role: "user",
        content: `(系统指令) 用户目标：【${goal}】。
你现在是**首席课程顾问**。
请摒弃所有社交辞令、比喻和情绪化表达。
保持**职业、冷静、高效** (Clinical & Professional)。
**任务**：
1. Feedback: 用最简练的语言确认收到需求。
2. NextQuestion: 立即抛出一个**技术/业务分流问题**，以确定课程方向。`,
      });
    }

    const result = streamText({
      model: chatModel,
      temperature: 0.7, // 稍微提高创造性以获得更好的文案
      output: Output.object({
        schema: interviewSchema,
      }),
      system: `你是一位追求极致效率的"首席课程顾问"。
用户想学的主题是："${goal}"。

你的沟通风格：**高信噪比、结果导向、零废话**。

### 🎭 开场策略 (Direct & Professional)
如果是第一轮对话：
- **Feedback**: 仅确认领域范围，不带感情色彩。
  - *Bad:* "哇，Python 真是个好选择！让我们开始..." (太情绪化)
  - *Good:* "针对 ${goal} 领域，我们需要先确定你的应用场景。"
- **NextQuestion**: 基于专业分类的二选一/多选一。
  - *Bad:* "你觉得自己水平怎么样？" (太笼统)
  - *Good:* "你的目标是**构建 Web 后端服务 (Django/FastAPI)**，还是**数据分析与机器学习 (Pandas/PyTorch)**？这将决定课程的技术栈侧重。"

### 🚫 禁忌 (Critical Constraints)
1. **禁止比喻**：不要说"代码是魔法"、"数据的海洋"。
2. **禁止过度礼貌**：不需要"请问"、"谢谢"、"希望能帮到你"，直接问问题。
3. **禁止模糊**：不要用"认知程度"这种词，用"实战经验"、"技术栈"、"业务场景"。
4. **禁止把 UI 选项念出来**：UI 选项会显示在按钮上，文本回复里不要重复。

### 🧠 深度推理与策略 (Deduction & Strategy)
利用 \`analysis\` 字段进行"思维链"推导：
1. **冲突检测**：检查用户回答是否推翻了 \`Current Profile\`？
2. **信息提取**：从字里行间提取 Prior Knowledge（背景）和 Cognitive Style（风格）。
   - *例:* 用户说 "我平时用 Excel 做透视表"，推断 -> Prior Knowledge=["Data Logic"], Level="No Code", Style="Action"。
3. **决策路径**：
   - 还没搞清方向？ -> **Ask** (提出分流问题)。
   - 方向明确但细节模糊？ -> **Suggest** (提供 UI 选项引导)。
   - 要素齐全 (Level, Outcome, Time)? -> **Finish** (完成画像)。

### 🎨 动态 UI 生成策略
不要使用硬编码的选项。根据对话上下文生成最自然的快捷回复：
- *Bad:* ["初级", "中级", "高级"] (太生硬)
- *Good (当用户想学日语时):* ["为了看懂无字幕动漫", "为了去日本旅游", "为了考级工作"]
- *Good (当用户想学前端时):* ["只会写 HTML/CSS", "写过一点 JS 但不熟", "已经能用 React 做项目"]

### 状态注入
当前已知的画像 (Current Profile):
${JSON.stringify(currentProfile || {}, null, 2)}
`,
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

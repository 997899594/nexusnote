# Interview Flow Fix 实施计划（2026 最佳架构）

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标:** 修复从"用户说我要学X"到"访谈完成"的完整链路，服务端作为真相来源。

**架构:**
- `conversations` 表存储 interview 状态（intent + metadata.courseProfileId）
- 服务端每轮读取 conversation 获取上下文
- 客户端只需传 sessionId，无需额外存储
- 使用 `addToolOutput` 继续 interview 工具调用

**技术栈:** AI SDK v6, React 19, Drizzle ORM, PostgreSQL

---

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                     API Route                           │
│                                                         │
│  1. 读取 conversation (sessionId)                       │
│     ├─ 有记录 → 用 conversation.intent                   │
│     └─ 无记录 → routeIntent() 检测                      │
│                                                         │
│  2. 如果 INTERVIEW 且无 courseProfileId                  │
│     └─ 创建 courseProfile，存入 metadata                │
│                                                         │
│  3. 执行 Agent，传 courseProfileId                       │
│                                                         │
│  4. 返回响应（客户端无需额外状态）                        │
└─────────────────────────────────────────────────────────┘
```

---

## Task 1: 清理 - 删除冗余代码

**文件:**
- 删除: `lib/ai/intent-router.ts` 中的 `aiIntentDetect` 函数
- 删除: `components/chat/InterviewContext.tsx`

**Step 1: 简化 intent-router.ts**

只保留规则匹配，删除 AI 检测：

```typescript
/**
 * Intent Router - 意图路由器（规则匹配，零成本）
 */

// 意图类型
export type UserIntent = "CHAT" | "INTERVIEW" | "COURSE" | "EDITOR" | "SEARCH";

// 学习意图关键词
const LEARNING_PATTERNS = [
  /我想学/,
  /我要学/,
  /教我/,
  /怎么学/,
  /如何学习/,
  /考研/,
  /备考/,
  /准备.*考试/,
];

// 编辑意图关键词
const EDITOR_PATTERNS = [/帮我.*写/, /修改.*文档/, /编辑/, /改一下/, /重写/, /润色/];

// 搜索意图关键词
const SEARCH_PATTERNS = [/搜索/, /查找/, /找一下/, /有没有.*笔记/];

/**
 * 快速意图检测（规则匹配，零成本）
 */
export function quickIntentDetect(message: string): { intent: UserIntent; topic?: string } | null {
  const msg = message.trim();

  // 检测学习意图
  for (const pattern of LEARNING_PATTERNS) {
    if (pattern.test(msg)) {
      const topic = msg
        .replace(/我想学|我要学|教我|怎么学|如何学习/g, "")
        .replace(/[？?！!。，,]/g, "")
        .trim();
      return { intent: "INTERVIEW", topic: topic || msg };
    }
  }

  // 检测编辑意图
  for (const pattern of EDITOR_PATTERNS) {
    if (pattern.test(msg)) {
      return { intent: "EDITOR" };
    }
  }

  // 检测搜索意图
  for (const pattern of SEARCH_PATTERNS) {
    if (pattern.test(msg)) {
      return { intent: "SEARCH" };
    }
  }

  return null;
}

/**
 * 意图路由（服务端从 conversation 恢复时不需要调用此函数）
 */
export function routeIntent(message: string): { intent: UserIntent; topic?: string } {
  const quickResult = quickIntentDetect(message);
  return quickResult ?? { intent: "CHAT" };
}
```

**Step 2: 删除 InterviewContext.tsx**

```bash
rm components/chat/InterviewContext.tsx
```

**Step 3: 运行 typecheck**

```bash
bun run typecheck
```

Expected: PASS（可能有未使用 import 警告）

**Step 4: Commit**

```bash
git add lib/ai/intent-router.ts
git rm components/chat/InterviewContext.tsx 2>/dev/null || true
git commit -m "refactor: simplify intent-router, remove unused InterviewContext"
```

---

## Task 2: 简化 ChatRequestSchema

**文件:**
- 修改: `lib/ai/validation.ts`

**Step 1: 移除 interviewSessionId**

```typescript
export const ChatRequestSchema = z.object({
  messages: z.array(z.unknown()).min(1),
  intent: z.enum(["CHAT", "INTERVIEW", "COURSE", "EDITOR", "SEARCH", "SKILLS", "STYLE"]).optional(),
  sessionId: z.string().optional(),
  personaSlug: z.string().regex(/^[a-z0-9_-]+$/).min(1).optional(),
  // 删除 interviewSessionId - 服务端从 conversation 恢复
  courseProfileId: z.string().uuid().optional(), // 保留，客户端可选传（兼容）
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

**Step 2: 运行 typecheck**

```bash
bun run typecheck
```

**Step 3: Commit**

```bash
git add lib/ai/validation.ts
git commit -m "refactor(validation): remove interviewSessionId, server owns state"
```

---

## Task 3: API Route - 从 Conversation 恢复 Interview 状态

**文件:**
- 修改: `app/api/chat/route.ts`

**Step 1: 修改 Intent Detection 逻辑**

找到当前的 intent detection 代码块，替换为：

```typescript
    // ============================================
    // Intent Routing - 从 Conversation 恢复或检测
    // ============================================
    const uiMessages = messages as UIMessage[];
    const lastUserMessage = uiMessages.filter((m) => m.role === "user").pop();
    const lastMessageText = extractTextFromMessage(lastUserMessage);

    let intent: UserIntent = "CHAT";
    let activeCourseProfileId: string | undefined = courseProfileId;

    // 1. 尝试从现有 conversation 恢复状态
    if (sessionId && userId && userId !== "anonymous") {
      const existingConversation = await db.query.conversations.findFirst({
        where: eq(conversations.id, sessionId),
      });

      if (existingConversation) {
        // 恢复 intent
        if (existingConversation.intent === "INTERVIEW" || existingConversation.intent === "COURSE") {
          intent = existingConversation.intent as UserIntent;
          console.log("[Chat] Restored intent from conversation:", intent);
        }

        // 恢复 courseProfileId from metadata
        const metadata = existingConversation.metadata as Record<string, unknown> | null;
        if (metadata?.courseProfileId) {
          activeCourseProfileId = metadata.courseProfileId as string;
          console.log("[Chat] Restored courseProfileId from conversation:", activeCourseProfileId);
        }
      }
    }

    // 2. 如果没有恢复到 INTERVIEW，检测新意图
    if (intent === "CHAT" && lastMessageText && !clientIntent) {
      const routeResult = routeIntent(lastMessageText);
      if (routeResult.intent !== "CHAT") {
        intent = routeResult.intent;
        console.log("[Chat] Detected new intent:", intent, "topic:", routeResult.topic);
      }
    }

    // 3. 客户端显式指定优先（如 /interview 命令）
    if (clientIntent) {
      intent = clientIntent;
    }
```

**Step 2: 确保 conversations 表 upsert 时保存 metadata**

找到 conversation upsert 代码，修改为：

```typescript
      try {
        // upsert conversation with metadata
        await db
          .insert(conversations)
          .values({
            id: sessionId,
            userId,
            title,
            intent,
            messageCount: uiMessages.length,
            metadata: activeCourseProfileId ? { courseProfileId: activeCourseProfileId } : {},
          })
          .onConflictDoUpdate({
            target: conversations.id,
            set: {
              intent,
              metadata: activeCourseProfileId ? { courseProfileId: activeCourseProfileId } : {},
              messageCount: uiMessages.length,
              lastMessageAt: new Date(),
            },
          });
      } catch (insertError) {
        console.warn("[ChatSession] Failed to upsert session:", insertError);
      }
```

**Step 3: 创建 courseProfile 后更新 conversation metadata**

找到创建 courseProfile 的位置，在创建后更新 conversation：

```typescript
        activeCourseProfileId = newProfile.id;
        console.log("[Interview] Created course profile:", activeCourseProfileId);

        // 更新 conversation metadata
        if (sessionId) {
          await db
            .update(conversations)
            .set({
              intent: "INTERVIEW",
              metadata: { courseProfileId: activeCourseProfileId },
            })
            .where(eq(conversations.id, sessionId));
        }
```

**Step 4: 删除旧的 interview session 相关代码**

删除：
- 内存 Map `interviewSessions`
- `X-Interview-Session-Id` 响应头
- `interviewSessionId` 相关逻辑

**Step 5: 运行 typecheck**

```bash
bun run typecheck
```

**Step 6: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "refactor(chat): restore interview state from conversation, remove memory store"
```

---

## Task 4: 客户端 - 简化，删除 Zustand Interview Store

**文件:**
- 修改: `stores/chat.ts`
- 修改: `components/chat/useChatSession.ts`

**Step 1: 删除 interviewSessionStore**

从 `stores/chat.ts` 删除 `useInterviewSessionStore`（如果之前添加了）。

**Step 2: 简化 useChatSession**

移除 onResponse 中读取 interview session 的逻辑，只保留 sessionId：

```typescript
const chat = useChat({
  id: sessionId ?? undefined,
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({
      sessionId,
      personaSlug: personaSlugRef.current,
    }),
  }),
  // ... 其他配置
});
```

**Step 3: 运行 typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add stores/chat.ts components/chat/useChatSession.ts
git commit -m "refactor(chat): simplify client, server owns interview state"
```

---

## Task 5: 修复 InterviewOptions - 使用 addToolOutput

**文件:**
- 修改: `components/chat/tool-result/ToolResultRenderer.tsx`
- 修改: `components/chat/ChatMessage.tsx`
- 修改: `components/chat/ChatPanel.tsx`

**Step 1: ToolResultRenderer 接收 addToolOutput**

```typescript
interface ToolResultRendererProps {
  toolPart: ToolPart;
  addToolOutput?: (toolCallId: string, output: unknown) => void;
}

export function ToolResultRenderer({ toolPart, addToolOutput }: ToolResultRendererProps) {
  // ... existing code ...

  case "suggestOptions": {
    const output = getOutput<"suggestOptions">(toolPart);
    if (!output) return null;
    return (
      <InterviewOptions
        question={output.question}
        options={output.options}
        allowCustom={output.allowCustom ?? true}
        allowSkip={output.allowSkip ?? false}
        multiSelect={output.multiSelect ?? false}
        onSelect={(selection) => {
          if (addToolOutput && toolPart.toolCallId) {
            addToolOutput(toolPart.toolCallId, { selected: selection });
          }
        }}
      />
    );
  }
```

**Step 2: ChatMessage 传递 addToolOutput**

```typescript
interface ChatMessageProps {
  message: UIMessage;
  addToolOutput?: (toolCallId: string, output: unknown) => void;
}

// in render:
<ToolResultRenderer
  key={toolPart.toolCallId}
  toolPart={toolPart}
  addToolOutput={addToolOutput}
/>
```

**Step 3: ChatPanel 从 useChat 获取 addToolOutput**

```typescript
const { addToolOutput } = chat;

// in render:
<ChatMessage key={msg.id} message={msg} addToolOutput={addToolOutput} />
```

**Step 4: 运行 typecheck**

```bash
bun run typecheck
```

**Step 5: Commit**

```bash
git add components/chat/tool-result/ToolResultRenderer.tsx \
        components/chat/ChatMessage.tsx \
        components/chat/ChatPanel.tsx
git commit -m "fix(interview): use addToolOutput to continue interview flow"
```

---

## Task 6: 验证 proposeOutline 流程

**文件:**
- 修改: `components/chat/tool-result/CourseOutlineCard.tsx`

**Step 1: 确认大纲确认流程**

当用户确认大纲时，需要：
1. 调用 `confirmOutline` 工具（如果有 addToolOutput）
2. 或者发送确认消息

修改 `CourseOutlineCard.tsx` 添加 `onConfirm` 回调：

```typescript
interface CourseOutlineCardProps {
  output: GenerateCourseOutput;
  onConfirm?: () => void;
}

export function CourseOutlineCard({ output, onConfirm }: CourseOutlineCardProps) {
  // ... existing code ...

  const handleGenerate = async () => {
    // ... existing generation logic ...

    if (onConfirm) {
      onConfirm();
    }
  };
}
```

**Step 2: ToolResultRenderer 传递 onConfirm**

```typescript
case "proposeOutline": {
  const output = getOutput<"proposeOutline">(toolPart);
  if (!output) return null;
  return (
    <CourseOutlineCard
      output={{ success: true, title: output.title, ... }}
      onConfirm={() => {
        if (addToolOutput && toolPart.toolCallId) {
          addToolOutput(toolPart.toolCallId, { confirmed: true });
        }
      }}
    />
  );
}
```

**Step 3: 运行 typecheck**

```bash
bun run typecheck
```

**Step 4: Commit**

```bash
git add components/chat/tool-result/CourseOutlineCard.tsx \
        components/chat/tool-result/ToolResultRenderer.tsx
git commit -m "fix(interview): add confirm callback to CourseOutlineCard"
```

---

## Task 7: 端到端测试

**Step 1: 启动开发服务器**

```bash
bun dev
```

**Step 2: 测试完整流程**

| 步骤 | 输入/操作 | 预期 |
|------|----------|------|
| 1 | "我要学全栈" | AI 检测 INTERVIEW，显示选项 |
| 2 | 点击选项 | 对话继续，仍是 INTERVIEW |
| 3 | "我有编程基础" | AI 更新 profile，继续访谈 |
| 4 | 几轮后 | AI proposeOutline |
| 5 | 确认大纲 | 创建课程 |

**Step 3: 检查数据库**

```sql
SELECT id, intent, metadata FROM conversations WHERE id = '<sessionId>';
```

预期：
- intent = "INTERVIEW" 或 "COURSE"
- metadata.courseProfileId 存在

**Step 4: 刷新页面测试**

刷新页面后，再次发送消息，应该继续 INTERVIEW 流程（而非重新检测）。

---

## 完成检查清单

- [ ] Task 1: 清理冗余代码
- [ ] Task 2: 简化 ChatRequestSchema
- [ ] Task 3: API Route 从 Conversation 恢复状态
- [ ] Task 4: 客户端简化
- [ ] Task 5: InterviewOptions 使用 addToolOutput
- [ ] Task 6: proposeOutline 确认流程
- [ ] Task 7: 端到端测试

---

## 架构优势

| 对比项 | 旧方案（补丁） | 新方案（2026） |
|--------|---------------|---------------|
| 状态存储 | 内存 Map | PostgreSQL |
| ID 数量 | 2个（sessionId + interviewSessionId） | 1个（sessionId） |
| 客户端职责 | 存储和传递状态 | 只传 sessionId |
| 刷新页面 | 丢失状态 | 状态保留 |
| 横向扩展 | ❌ 内存不共享 | ✅ DB 共享 |

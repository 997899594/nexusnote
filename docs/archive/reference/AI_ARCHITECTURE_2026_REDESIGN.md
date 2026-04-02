# NexusNote AI 架构重构 - 2026 新架构设计

## 1. 当前架构问题总结

### 1.1 核心问题
| 问题 | 影响 | 优先级 |
|------|------|--------|
| Registry 单例模块级初始化 | 启动慢、难以测试 | CRITICAL |
| 多 Provider Fallback 复杂 | 维护成本高、不需要 | CRITICAL |
| 无请求验证 | 安全风险 | HIGH |
| 状态管理分散 | 难以维护 | HIGH |
| 重复代码多 | 维护困难 | MEDIUM |

### 1.2 当前架构图
```
请求 → API Route → Intent Router → Agent → Tools → LLM
                      ↓
              Registry (多 Provider)
```

---

## 2. 2026 新架构设计

### 2.1 架构原则

1. **简单优先** - 不要过度工程化
2. **单 Provider** - 302.ai 足够，不需要 fallback
3. **类型安全** - 全链路 Zod 校验
4. **可测试** - 依赖注入代替单例
5. **可观测** - 统一的日志和错误处理

### 2.2 新架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                               │
│  /api/chat → ChatHandler (统一入口)                              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Validation Layer                             │
│  ChatRequestSchema (Zod) → sanitize → rateLimit                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Factory                                │
│  getAgent(intent, context) → ChatAgent | InterviewAgent ...    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Provider Layer                              │
│  AIProvider (302.ai only) - 懒加载单例                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       Tools Layer                                │
│  ToolRegistry - 统一的工具注册和执行                            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 模块设计

### 3.1 Provider Layer (ai/provider/)

```typescript
// apps/web/features/ai/provider/index.ts

interface AIProvider {
  chat(model: string, options: ChatOptions): LanguageModel;
  embedding(model: string): EmbeddingModel;
}

class Provider302 implements AIProvider {
  private client: OpenAI;
  
  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://api.302.ai/v1',
      apiKey: env.AI_302_API_KEY,
    });
  }
  
  // 懒加载
  static getInstance(): Provider302 {
    if (!Provider302.instance) {
      Provider302.instance = new Provider302();
    }
    return Provider302.instance;
  }
}

export const provider = Provider302.getInstance();
```

### 3.2 Validation Layer (ai/validation/)

```typescript
// apps/web/features/ai/validation/request.ts

import { z } from "zod";

export const ChatRequestSchema = z.object({
  messages: z.array(z.unknown()),
  explicitIntent: z.enum([
    "INTERVIEW", 
    "CHAT", 
    "EDITOR", 
    "SEARCH", 
    "COURSE_GENERATION"
  ]).default("CHAT"),
  
  // Interview specific
  sessionId: z.string().uuid().optional(),
  initialGoal: z.string().max(500).optional(),
  
  // Course generation specific
  courseGenerationContext: z.record(z.unknown()).optional(),
  
  // Common
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(32000).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// 输入净化
export function sanitizeInput(input: string): string {
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // 移除控制字符
    .slice(0, 50000); // 限制长度
}
```

### 3.3 Agent Factory (ai/agents/factory/)

```typescript
// apps/web/features/ai/agents/factory.ts

import { provider } from "../provider";
import { createChatAgent } from "./chat-agent";
import { createInterviewAgent } from "./interview-agent";
import { createCourseGenerationAgent } from "./course-generation-agent";

type AgentFactory = (context: AgentContext) => ToolLoopAgent;

const AGENT_REGISTRY: Record<string, AgentFactory> = {
  INTERVIEW: createInterviewAgent,
  CHAT: createChatAgent,
  EDITOR: createChatAgent, // 复用 chat agent
  SEARCH: createChatAgent, // 复用 chat agent
  COURSE_GENERATION: createCourseGenerationAgent,
};

export function getAgent(
  intent: string, 
  context: AgentContext
): ToolLoopAgent {
  const factory = AGENT_REGISTRY[intent];
  if (!factory) {
    throw new Error(`Unknown intent: ${intent}`);
  }
  return factory(context);
}

export function registerAgent(
  name: string, 
  factory: AgentFactory
): void {
  AGENT_REGISTRY[name] = factory;
}
```

### 3.4 Tools Layer (ai/tools/)

```typescript
// apps/web/features/ai/tools/registry.ts

import { tool } from "ai";
import { z } from "zod";

interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodSchema;
  execute: (input: unknown) => Promise<unknown>;
}

// 工具注册表
const TOOL_REGISTRY = new Map<string, ToolDefinition>();

export function registerTool(def: ToolDefinition): void {
  TOOL_REGISTRY.set(def.name, def);
}

// 通用工具 - 文档编辑
export const editDocumentTool = tool({
  description: "编辑文档内容",
  inputSchema: z.object({
    documentId: z.string(),
    targetId: z.string(),
    action: z.enum(["replace", "insert_after", "insert_before", "delete"]),
    content: z.string(),
  }),
  execute: async ({ documentId, targetId, action, content }) => {
    // 实现逻辑
    return { success: true, documentId };
  },
});

// 工具集导出
export const tools = {
  editDocument: editDocumentTool,
  // ... 其他工具
};

export type ToolName = keyof typeof tools;
```

### 3.5 Context Cache (ai/context/)

```typescript
// apps/web/features/ai/context/cache.ts

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
}

class ContextCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
  
  set<T>(key: string, value: T, ttlMs: number = 30000): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl: ttlMs,
    });
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

export const contextCache = new ContextCache();
```

---

## 4. API 重构

### 4.1 统一入口

```typescript
// apps/web/app/api/ai/chat/route.ts

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { ChatRequestSchema, sanitizeInput } from "@/features/ai/validation";
import { getAgent } from "@/features/ai/agents/factory";
import { createAgentUIStreamResponse, smoothStream } from "ai";
import { contextCache } from "@/features/ai/context/cache";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 分钟

export async function POST(request: NextRequest) {
  // 1. 认证
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 验证请求
  const parseResult = ChatRequestSchema.safeParse(await request.json());
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parseResult.error.issues },
      { status: 400 }
    );
  }

  const { messages, explicitIntent, sessionId, courseGenerationContext } = parseResult.data;
  const userId = session.user.id;

  // 3. 净化输入
  const sanitizedMessages = messages.map((msg: any) => ({
    ...msg,
    content: typeof msg.content === 'string' 
      ? sanitizeInput(msg.content) 
      : msg.content,
  }));

  // 4. 构建 Agent 上下文
  const context = {
    userId,
    sessionId,
    courseGenerationContext,
    messages: sanitizedMessages,
  };

  // 5. 获取 Agent
  const agent = getAgent(explicitIntent, context);

  // 6. 流式响应
  const response = await createAgentUIStreamResponse({
    agent,
    uiMessages: sanitizedMessages,
    options: context,
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
    }),
  });

  // 7. 设置响应头
  if (sessionId) {
    response.headers.set("X-Session-Id", sessionId);
  }
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}
```

---

## 5. 目录结构

```
apps/web/features/ai/
├── index.ts                      # 统一导出
├── provider/                     # Provider 层
│   ├── index.ts                  # 懒加载单例
│   └── models.ts                 # 模型配置
├── validation/                   # 验证层
│   ├── request.ts                # 请求验证
│   └── response.ts               # 响应验证
├── agents/                       # Agent 工厂
│   ├── factory.ts                # 工厂函数
│   ├── chat-agent.ts             # 聊天 Agent
│   ├── interview-agent.ts        # 访谈 Agent
│   └── course-agent.ts           # 课程生成 Agent
├── tools/                        # 工具层
│   ├── registry.ts               # 工具注册
│   ├── editor.ts                 # 编辑工具
│   ├── learning.ts               # 学习工具
│   └── search.ts                 # 搜索工具
├── context/                      # 上下文管理
│   ├── cache.ts                  # 缓存
│   └── session.ts                # 会话管理
└── middleware/                   # 中间件
    ├── logging.ts                 # 日志
    ├── error-handler.ts          # 错误处理
    └── tracing.ts                # 链路追踪
```

---

## 6. 实施计划

### Phase 1: 基础设施 (1天)
- [ ] 创建 `features/ai/` 目录结构
- [ ] 实现 Provider 层 (单 302.ai)
- [ ] 实现 Validation 层 (Zod)

### Phase 2: Agent 工厂 (1天)
- [ ] 重构 Agent 定义，使用工厂模式
- [ ] 统一 Tools 注册
- [ ] 实现 Context Cache

### Phase 3: API 重构 (1天)
- [ ] 新建 `/api/ai/chat` 路由
- [ ] 添加中间件 (日志、错误处理)
- [ ] 验证和安全

### Phase 4: 迁移 (2天)
- [ ] 迁移 Interview Agent
- [ ] 迁移 Course Generation Agent
- [ ] 迁移 Chat Agent
- [ ] 测试和修复

### Phase 5: 优化 (1天)
- [ ] 添加缓存
- [ ] 性能优化
- [ ] 文档完善

---

## 7. 验收标准

1. ✅ 单一入口 `/api/ai/chat`
2. ✅ 全链路 Zod 类型校验
3. ✅ 302.ai 单 Provider，无 Fallback
4. ✅ Agent 工厂模式，易于扩展
5. ✅ 工具统一注册
6. ✅ Context 缓存层
7. ✅ 统一的错误处理和日志
8. ✅ 可测试性提升

---

## 8. 待删除文件

重构完成后可删除以下文件：
- `features/shared/ai/registry.ts` (替换为 `ai/provider/`)
- `features/shared/ai/router/route.ts` (替换为 `ai/agents/factory.ts`)
- `features/shared/ai/fallback-model.ts` (不需要 Fallback)
- `features/shared/ai/circuit-breaker.ts` (不需要熔断)

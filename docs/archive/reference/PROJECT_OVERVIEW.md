# NexusNote 项目梳理

> 生成时间：2026-03-10
> 当前 commit：0fc3a9d

## 一、项目定位

**NexusNote** 是一个 AI 原生的知识管理系统，核心特点：

- 🤖 **多模型 AI 架构**：Gemini 3 (via 302.ai) + BGE 嵌入模型
- 📝 **实时协作编辑**：Tiptap + Yjs + PartyKit
- 🔍 **RAG 向量检索**：PostgreSQL + pgvector
- 📚 **学习系统**：FSRS-5 间隔重复算法
- 🎨 **个性化**：风格分析、情感检测、AI 人格

## 二、技术栈

### 核心框架
- **Next.js 16** + **React 19**：App Router 架构
- **TypeScript 5.7**：类型安全
- **Bun**：包管理器和运行时

### AI 相关
- **AI SDK v6**：Vercel AI SDK，统一的 AI 接口
- **302.ai**：AI 服务提供商（Gemini 3）
- **pgvector**：向量数据库扩展

### 数据层
- **PostgreSQL 16**：主数据库
- **Drizzle ORM**：类型安全的 ORM
- **Redis 7**：缓存和队列
- **BullMQ**：异步任务队列

### 编辑器
- **Tiptap v3**：富文本编辑器
- **Yjs**：CRDT 协同算法
- **PartyKit**：WebSocket 协同服务器

### UI
- **Tailwind CSS 4**：样式
- **Framer Motion**：动画
- **Radix UI**：无障碍组件
- **Lucide React**：图标

## 三、目录结构

```
nexusnote/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── chat/         # 聊天 API
│   │   ├── interview/    # 访谈 API
│   │   ├── courses/      # 课程 API
│   │   └── ...
│   ├── chat/             # 聊天页面
│   ├── interview/        # 访谈页面
│   ├── learn/            # 学习页面
│   ├── editor/           # 编辑器页面
│   └── ...
├── components/            # React 组件
│   ├── chat/             # 聊天组件
│   ├── editor/           # 编辑器组件
│   ├── interview/        # 访谈组件
│   └── ui/               # 基础 UI 组件
├── lib/                   # 核心库
│   ├── ai/               # AI 相关
│   │   ├── agents/       # AI Agents
│   │   ├── core/         # 核心功能
│   │   ├── tools/        # AI 工具
│   │   ├── prompts/      # 提示词
│   │   └── schemas/      # 数据模型
│   ├── rag/              # RAG 系统
│   ├── chat/             # 聊天逻辑
│   └── ...
├── hooks/                 # React Hooks
├── stores/                # Zustand 状态管理
├── db/                    # 数据库
│   └── schema.ts         # Drizzle Schema
├── party/                 # PartyKit 服务器
└── config/                # 配置文件
```

## 四、核心功能模块

### 1. AI 聊天系统

**路径**：`app/api/chat/route.ts`

**流程**：
1. 认证 + 限流（100 req/min）
2. 请求验证（Zod）
3. 加载个性化配置（persona、用户上下文）
4. 会话管理
5. Agent 选择（基于 intent）
6. 流式响应
7. 使用量追踪

**Agent 类型**：
- `chat`：通用聊天
- `course`：课程生成
- `interview`：访谈
- `skills`：技能发现

**关键文件**：
- `lib/ai/agents/chat.ts`：聊天 Agent
- `lib/ai/tools/chat/`：聊天工具（搜索、笔记、网页搜索）
- `lib/ai/core/streaming.ts`：流式响应封装

### 2. Interview 访谈系统

**路径**：`app/api/interview/route.ts`

**当前架构**（0fc3a9d）：
- 使用 AI SDK 的 `ToolLoopAgent`
- 2 个工具：`updateProfile` + `confirmOutline`
- 从数据库读取 `interviewProfile` 判断阶段
- 流式返回结果

**数据模型**：
```typescript
InterviewProfile {
  goal: string | null        // 学习目标
  background: string         // 基础水平
  outcome: string | null     // 期望成果
}
```

**关键文件**：
- `lib/ai/agents/interview.ts`：Interview Agent
- `lib/ai/tools/interview/`：访谈工具
- `hooks/useInterview.ts`：前端 Hook
- `app/interview/page.tsx`：访谈页面

### 3. RAG 向量检索

**路径**：`lib/rag/`

**流程**：
```
文档 → 智能分块 → BGE 嵌入 (4000D) → pgvector
                                        ↓
用户查询 → 嵌入 → 余弦相似度 → 重排序 → Top 结果
                                        ↓
                        Gemini 3 ← 上下文 + 查询
```

**关键文件**：
- `lib/rag/chunking.ts`：文档分块
- `lib/rag/embedding.ts`：嵌入生成
- `lib/rag/retrieval.ts`：检索逻辑

### 4. 实时协作编辑

**路径**：`party/server.ts` + `components/editor/`

**技术**：
- **Yjs**：CRDT 协同算法
- **PartyKit**：WebSocket 服务器
- **Tiptap**：富文本编辑器

**功能**：
- 实时光标位置
- 用户在线状态
- 自动保存快照（每 5 分钟）
- 版本对比和恢复

### 5. 学习系统

**路径**：`app/learn/` + `lib/ai/tools/learning/`

**功能**：
- FSRS-5 间隔重复算法
- AI 生成闪卡
- 进度追踪
- 掌握度评估

## 五、数据库设计

**主要表**：
- `users`：用户
- `documents`：文档
- `document_chunks`：文档分块（向量）
- `chat_sessions`：聊天会话
- `course_sessions`：课程会话
- `flashcards`：闪卡
- `review_logs`：复习记录

**向量字段**：
- `document_chunks.embedding`：`vector(4000)`

## 六、AI 架构

### 模型策略

```typescript
// lib/ai/core/index.ts
{
  chatModel: Gemini 3 Flash,      // 通用对话
  proModel: Gemini 3 Pro,         // 复杂任务
  webSearchModel: 带搜索的模型,
  embeddingModel: BGE-base-zh-v1.5 // 嵌入
}
```

### Agent 系统

使用 AI SDK v6 的 `ToolLoopAgent`：

```typescript
new ToolLoopAgent({
  id: "nexusnote-chat",
  model: aiProvider.chatModel,
  instructions: "...",
  tools: chatTools,
  stopWhen: stepCountIs(20),
})
```

### 熔断器模式

三状态熔断器（closed → open → half-open）：
- 主提供商：302.ai
- 备用提供商：DeepSeek V3、OpenAI

## 七、部署架构

### Kubernetes 部署

```
K3s Cluster
├── nexusnote-web (Next.js API, port 3000)
├── nexusnote-collab (Hocuspocus WS, port 1234)
├── nexusnote-worker (BullMQ RAG indexing)
├── PostgreSQL 16 + pgvector (10Gi)
└── Redis 7 (1Gi)
```

### 域名和 TLS
- https://juanie.art
- Let's Encrypt TLS
- Cilium Gateway API

## 八、当前问题和待改进

### Interview 系统问题

1. **对话质量差**
   - AI 理解能力不够
   - 机械式对话
   - 重复提问

2. **架构复杂**
   - 之前尝试的 LangGraph + AI SDK 集成过于复杂
   - 效果不理想
   - 已回退到 0fc3a9d

3. **流式输出**
   - 当前是 chunk 级别，不是真正的打字机效果
   - 需要前端实现逐字动画

### 建议改进方向

1. **简化 Interview 架构**
   - 使用 AI SDK 的 `streamText` + tools
   - 不要过度抽象
   - 先验证效果，再优化架构

2. **改进提示词**
   - 更自然的对话风格
   - 更好的上下文理解
   - 避免机械式提问

3. **前端体验**
   - 实现打字机效果
   - 更好的加载状态
   - 错误处理

## 九、开发指南

### 启动项目

```bash
# 安装依赖
bun install

# 启动开发服务器
bun dev

# 启动协作服务器
bunx partykit dev

# 数据库操作
bun run db:push
bun run db:studio
```

### 环境变量

关键环境变量（`.env`）：
- `AI_302_API_KEY`：302.ai API 密钥
- `DATABASE_URL`：PostgreSQL 连接
- `REDIS_URL`：Redis 连接
- `NEXTAUTH_SECRET`：认证密钥

### 代码规范

- **Linter**：Biome（不是 ESLint）
- **格式化**：`bun run lint --write`
- **类型检查**：`bun run typecheck`

## 十、参考资料

- [AI SDK 文档](https://sdk.vercel.ai/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Tiptap](https://tiptap.dev/)
- [PartyKit](https://www.partykit.io/)
- [pgvector](https://github.com/pgvector/pgvector)

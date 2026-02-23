# 2026 RSC 完整现代化架构 - 设计文档

**日期**: 2026-02-23
**状态**: 已批准
**作者**: Claude + 用户协作

---

## 1. 概述

### 目标

实现完整的 2026 年现代化架构，支持：
1. **流式 Markdown 渲染** - 使用 Streamdown 优化 AI 响应体验
2. **Generative UI** - AI 工具调用生成动态 UI 组件
3. **Tiptap 服务端转换** - Markdown ↔ Tiptap JSON 无 DOM 转换
4. **完整 RSC 架构** - Server + Client 分离模式

### 技术栈

| 功能 | 技术方案 | 版本 |
|------|----------|------|
| 流式 Markdown | streamdown | 最新 |
| 代码高亮 | @streamdown/code (Shiki) | - |
| 数学公式 | @streamdown/math (KaTeX) | - |
| Mermaid 图表 | @streamdown/mermaid | - |
| 中文优化 | @streamdown/cjk | - |
| AI 聊天 | @ai-sdk/react (useChat) | v6 |
| 生成式 UI | streamUI (ai/rsc) | - |
| Tiptap 服务端 | MarkdownManager | 3.20 |
| 动画 | Framer Motion | 12 |

---

## 2. 整体架构

### 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│                     Next.js 16 + React 19                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  🟦 Server Components (默认)                                  │
│  ├─ 数据获取 (直接 DB 查询)                                  │
│  ├─ 初始 HTML 渲染                                           │
│  ├─ Suspense 边界 (Skeleton)                                 │
│  ├─ Markdown → Tiptap JSON 服务端转换                        │
│  └─ Generative UI 工具映射                                   │
│                                                               │
│  🟩 Client Components ("use client")                          │
│  ├─ 交互 (onClick, useState)                                  │
│  ├─ 动画 (Framer Motion)                                     │
│  ├─ 编辑器 (Tiptap)                                           │
│  ├─ 流式聊天 (useChat + Streamdown)                          │
│  └─ Generative UI 消费 (useStreamableUI)                     │
│                                                               │
│  🔄 Server Actions (混合层)                                    │
│  ├─ AI 流式响应 (streamUI)                                    │
│  ├─ 工具调用 (searchNotes, createFlashcard 等)                │
│  └─ 数据流: Server → Client                                   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 文件结构

### 新增文件

```
nexusnote/
├── components/
│   ├── chat/
│   │   └── StreamdownMessage.tsx          # 🆕 流式 Markdown 渲染
│   └── shared/
│       └── home/
│           └── MarkdownRenderer.tsx        # 🔄 改用 Streamdown
│
├── lib/
│   └── tiptap/
│       └── markdown.ts                     # 🆕 MarkdownManager 转换工具
│
├── app/
│   ├── ai-ui/
│   │   ├── actions.ts                      # 🆕 Generative UI Server Actions
│   │   └── AIProvider.tsx                  # 🆕 全局 AI Provider
│   │
│   └── flashcards/
│       └── flashcards-client.tsx           # 🆕 创建 Client Component
│
└── app/globals.css                         # 🔄 添加 Streamdown @source
```

### 组件职责

| 组件 | 类型 | 职责 |
|------|------|------|
| `StreamdownMessage` | Client | 流式渲染 AI 消息（带所有插件） |
| `MarkdownRenderer` | Client | 通用 Markdown 渲染（复用 Streamdown） |
| `flashcards-client.tsx` | Client | 闪卡翻转动画、CRUD 操作 |
| `lib/tiptap/markdown.ts` | Server | MD ↔ Tiptap JSON 双向转换 |
| `app/ai-ui/actions.ts` | Server | streamUI + 工具调用逻辑 |
| `app/ai-ui/AIProvider.tsx` | Client | createAI 包装，全局状态 |

---

## 4. 数据流

### AI 聊天流式渲染

```
用户发送消息
    ▼
POST /api/chat
    ├─ 验证用户身份
    ├─ 记录会话 (DB)
    └─ 调用 AI Agent
    ▼
createAgentUIStreamResponse
    ├─ smoothStream (中文分块)
    └─ 流式返回
    ▼
Client: useChat() 接收流
    └─ messages 实时更新
    ▼
StreamdownMessage 渲染
    ├─ plugins: { code, math, mermaid, cjk }
    ├─ isAnimating={status === 'streaming'}
    └─ 实时解析不完整 Markdown
```

### Generative UI 工具调用

```
用户: "帮我创建 React Hooks 的闪卡"
    ▼
AI 决策: 调用 createFlashcard 工具
    ├─ 解析参数: front, back
    └─ 触发 generate 函数
    ▼
generate: async function* ({ front, back })
    ├─ yield <div>创建中...</div>
    ├─ await db.insert(flashcards)
    └─ return <FlashcardCard />
    ▼
Client 渲染流式 UI
    └─ 用户看到: "创建中..." → 闪卡卡片
```

### Markdown → Tiptap 转换

```
Server: AI 生成 Markdown
    "# Hello\n\n这是 **加粗** 文本"
    ▼
lib/tiptap/markdown.ts
    markdownToJson(markdown)
    └─ MarkdownManager.parse()
    ▼
Tiptap JSON
    { "type": "doc", "content": [...] }
    ▼
Client: Tiptap Editor 加载
    └─ editor.setContent(json)
```

---

## 5. 组件设计

### StreamdownMessage

```tsx
interface StreamdownMessageProps {
  content: string;           // Markdown 内容
  isStreaming?: boolean;     // 是否正在流式生成
  className?: string;
}
```

### flashcards-client

```tsx
interface FlashcardsClientProps {
  initialCards: Flashcard[];      // Server 预取的数据
  userId?: string;                // 可选用户 ID
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  // ...
}
```

### Generative UI 工具

| 工具名 | 描述 | 参数 | 返回 UI |
|--------|------|------|---------|
| `searchNotes` | 搜索用户笔记 | `query: string` | 笔记列表卡片 |
| `createFlashcard` | 创建闪卡 | `front, back` | 闪卡预览卡片 |
| `generateQuiz` | 生成测验题 | `topic, count` | 测验表单 |

---

## 6. 错误处理

### 降级策略

| 场景 | 处理方式 | 用户体验 |
|------|----------|----------|
| Streamdown 解析失败 | 降级到纯文本 | 显示原始内容 |
| KaTeX 加载失败 | 跳过数学公式渲染 | 显示 $公式$ 原文 |
| Mermaid 渲染失败 | 保留代码块 | 显示 mermaid 代码 |
| AI 流式中断 | 显示已接收内容 | 允许用户重新生成 |
| Tiptap 转换失败 | 使用原始 Markdown | 编辑器正常工作 |

### 安全边界

```tsx
// StreamdownMessage.tsx 安全边界
export function StreamdownMessage({ content, isStreaming }: Props) {
  try {
    return (
      <Streamdown
        plugins={{ code, math, mermaid, cjk }}
        isAnimating={isStreaming}
      >
        {content}
      </Streamdown>
    );
  } catch (error) {
    // 降级到纯文本
    return <pre className="whitespace-pre-wrap">{content}</pre>;
  }
}
```

---

## 7. 依赖安装

```bash
# 核心库
pnpm add streamdown
pnpm add @streamdown/code @streamdown/math @streamdown/mermaid @streamdown/cjk
pnpm add katex
```

### Tailwind 配置

```css
/* app/globals.css */
@source "../node_modules/streamdown/dist/*.js";
```

---

## 8. 验证清单

### 构建验证
- [ ] `pnpm run build` 成功无错误
- [ ] `pnpm run typecheck` 类型检查通过
- [ ] 无 Tailwind @source 路径错误

### 运行时验证
- [ ] AI 响应实时流式渲染
- [ ] 代码块语法高亮正确
- [ ] 数学公式 $E=mc^2$ 渲染正确
- [ ] Mermaid 图表按钮出现
- [ ] 中文文本无换行问题
- [ ] Framer Motion 动画流畅
- [ ] Tiptap 编辑器正确加载预渲染内容

### 性能验证
- [ ] 客户端 JS bundle 大小合理
- [ ] 首屏加载时间无退化
- [ ] 流式渲染延迟 < 100ms

---

## 9. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Streamdown 与现有样式冲突 | 样式错乱 | 使用 CSS 命名空间隔离 |
| KaTeX 字体加载慢 | 公式闪烁 | 预加载字体 |
| Mermaid 包体积大 | 首屏变慢 | 按需动态导入 |
| Generative UI 状态同步难 | UI 不一致 | 使用 useStreamableUI |

---

## 10. 实施计划

详细实施计划将使用 `writing-plans` 技能创建，包含以下阶段：

1. **阶段 1**: 核心库升级与依赖安装
2. **阶段 2**: 流式 Markdown 渲染 (Streamdown)
3. **阶段 3**: Tiptap 服务端集成
4. **阶段 4**: RSC 重构 (渐进式)
5. **阶段 5**: AI SDK v6 RSC 流式 UI (Generative UI)
6. **阶段 6**: 更新聊天系统
7. **阶段 7**: Tailwind 配置
8. **阶段 8**: 全局 AI Provider 集成

---

**设计状态**: ✅ 已批准，准备进入实施计划阶段

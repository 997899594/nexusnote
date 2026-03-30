# 2026-03-30 Runtime And Knowledge Workbench Design

## Scope

本次整改只做以下 9 项：

1. 收敛 AI provider 架构到 302 单 provider
2. 聊天持久化升级为流式可恢复
3. 显式锁定 Next.js Cache Components 策略
4. 工具展示契约下沉到服务端传输层
5. 超长全局对话的摘要压缩与记忆注入
6. AI 服务降级模式
7. 清理遗留依赖和环境变量
8. 清理 React Compiler 时代的过度 memoization
9. 把笔记系统补成跨课程知识工作台

本次不扩展到 health check、部署治理、测试基建之外的其他主题。

## Requirements Summary

### Functional

- 所有 LLM、embedding、structured generation 都统一走 302.ai
- Chat 支持断线恢复进行中的响应流
- 隐藏工具不能再通过流式消息直接暴露给前端
- 全局聊天在长对话下仍能保持上下文质量
- 302 不可用时，聊天、访谈、索引、沉淀要进入明确的降级状态
- 笔记页从“最近沉淀列表”升级为“跨课程知识工作台”

### Non-functional

- 不引入新的双 provider 复杂度
- 不依赖前端猜测状态
- 优先复用现有表结构与 Redis
- 改造后 lint / typecheck 必须通过
- 迁移范围尽量控制在无破坏或低风险

## Architecture Decisions

### ADR-1: Provider 收口为 302 单 provider

#### Decision

移除 runtime fallback provider 逻辑，`lib/ai/core/provider.ts` 只保留 302.ai client 和模型映射。

#### Why

- 当前产品决策已经明确依赖 302
- fallback 让 env、错误处理、观测、测试矩阵全部翻倍
- “偶发切到别的 provider”会让行为和时延更难解释

#### Trade-off

- 失去 provider 级自动切换
- 需要把“模型不可用”的处理显式建模成降级，而不是静默 fallback

### ADR-2: Chat 持久化从“整轮结束写库”升级为“流式可恢复 + 完成后固化”

#### Decision

- 使用 AI SDK UI 的 resumable streams 方案
- Redis 存进行中的 UIMessage SSE 流
- 会话元数据记录 `activeStreamId`
- 完成后再把最终消息快照写入 `conversation_messages`

#### Why

- 当前 `onFinish` 后整包 PATCH 不能覆盖刷新/断线恢复
- 2026 的正确方案是 `resume: true + consumeSseStream + reconnect endpoint`

#### Trade-off

- 需要引入 `resumable-stream`
- 与 abort 不兼容，UI 需要接受这一限制

### ADR-3: 工具展示契约下沉到传输层

#### Decision

服务端在 UIMessage chunk 层做过滤：

- `chat` 只放行 `chat` presentation tools
- `interview` 只放行 `interview` presentation tools
- `hidden` 工具默认不下发

同时仍保留前端 renderer 层兜底。

#### Why

- UI 隐藏不等于协议隔离
- 当前问题本质是“服务端把不该展示的 part 也发出来了”

### ADR-4: 长对话采用“摘要记忆 + 最近消息窗口”

#### Decision

对全局 `CHAT` 会话引入两层上下文：

- `conversation.summary` 保存长期记忆摘要
- `conversation_messages` 保留最近窗口消息

当消息超预算时：

- 对较早消息做摘要压缩
- 更新 `summary`
- 只保留最近窗口消息继续参与下轮对话

注入方式：

- 在 `buildPersonalization + resolveChatContext` 之后，把 summary 作为系统级补充上下文注入

#### Why

- 单纯截断会让长期助手失忆
- 学习场景更适合“长期目标/偏好/约束”记忆，而不是无限堆原始消息

### ADR-5: AI 服务降级不是单一报错，而是能力分级

#### Decision

定义三类降级：

- `chat_unavailable`: 交互式回复不可用
- `structured_unavailable`: 结构化生成不可用，允许文本级 fallback
- `embedding_unavailable`: 检索和索引降级为无 embedding / keyword-only

对应策略：

- Chat / Interview route 返回统一错误码和用户可理解提示
- RAG indexing 保持现有“无 embedding 也可落库”的方向
- UI 通过 metadata 或 error code 区分“暂时不可用”与“已进入降级模式”

## Implementation Plan

### Phase 1: Runtime 基座

- `lib/ai/core/provider.ts` 收敛为 302 单 provider
- 清理 fallback env、README、deploy env example、package deps
- `next.config.js` 显式开启 `cacheComponents`
- 新增 AI 降级分类 helper
- 新增服务端 UIMessage tool chunk 过滤器

### Phase 2: Resumable Chat

- 引入 `resumable-stream`
- `useChatSession` 启用 `resume: true`
- `/api/chat` 使用 `consumeSseStream`
- 新增 `/api/chat/[id]/stream`
- 会话 metadata 维护 `activeStreamId`

### Phase 3: Conversation Memory

- 持久化时触发超长对话压缩
- `conversation.summary` 升级为长期记忆摘要
- Chat agent 读取 summary 注入上下文

### Phase 4: Notes Workbench

- editor index 改为工作台
- 提供统一聚合维度：
  - 全部
  - 高亮
  - 笔记
  - 沉淀
  - 按课程
- 强化来源卡片、课程回跳、回顾入口

### Phase 5: UI And Cleanup

- 清理明显无收益的 `useCallback` / `useMemo`
- 统一页面级 spacing、safe-area、卡片密度

## Risks

### Resumable streams complexity

需要严格遵守 AI SDK 的恢复流模式，避免和现有停止逻辑冲突。

### Memory summarization quality

摘要过强会丢事实，摘要过弱会继续拖长上下文。需要把摘要限定成“目标、偏好、已确认结论、待办问题”。

### Notes workbench scope creep

工作台优先做信息架构和聚合，不在这轮扩展成完整 PKM 系统。

## Success Criteria

- provider/runtime 配置只剩 302 主路径
- chat 刷新后可以恢复进行中的响应流
- 隐藏工具不再出现在客户端消息流里
- 长对话不会只靠截断维持
- 笔记首页成为跨课程知识工作台，而不是最近列表

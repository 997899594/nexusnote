# AI SDK v6 Project Guidelines

> NexusNote 的 AI SDK v6 实施规范。
> 本文档不是替代已有资料，而是把项目里真正要遵守的规则收成一份可执行标准。

## Canonical References

以下两份文档是本项目 AI SDK v6 的一手参考，后续实现优先以它们为准：

- [AI SDK v6 开发指南（NexusNote 实战版）](/Users/findbiao/projects/nexusnote/docs/ai-sdk-v6-guide.md)
- [AI SDK v6 高级功能速查](/Users/findbiao/projects/nexusnote/docs/ai-sdk-v6-advanced-features.md)

如果后续实现和这两份文档冲突，应先修实现，不要继续堆补丁。

## Core Principle

AI SDK v6 在 NexusNote 里的主原则是：

- 用 `ToolLoopAgent` 处理开放式对话和真流式体验
- 用 `UIMessage.parts` 承载富消息，而不是让前端猜测消息结构
- 用 tool 或 tool part 表示 AI 在同一轮回复里要返回的结构化 UI 结果或能力调用
- 用 data part 表示结构化 UI 数据
- 用 workflow 表示固定顺序、有副作用的后台流程

不要为了“快修”绕开这些抽象，除非有明确证据表明 SDK 本身做不到。

## Message Design

assistant 消息优先使用 `UIMessage.parts` 组织：

- `text` part: 正文流式文本
- `tool-*` part: 工具调用和工具输出
- `data-*` part: 自定义结构化 UI 数据

不要让模型用纯文本伪造结构化协议，例如：

- 不要让模型在正文里手写 JSON 再让前端解析
- 不要让前端从自然语言里猜测 options、outline、mode

## Tool Rules

以下场景应该做成 tool：

- AI 在同一轮回复里就需要返回的结构化 UI 结果
- 会触发真实业务动作
- 会写库、改状态、调用明确能力
- 是否执行这个动作，需要模型在对话中决定

在 NexusNote 中：

- interview 的 `presentOptions`、`presentOutlinePreview` 这类同轮 rich UI 返回可使用 tool part
- 学习/聊天中的搜索、检索、改写、调用外部能力应优先是 tool
- 编辑器中的 AI 内容变更动作应优先是 tool 或 action-like tool

以下场景不应该做成 tool：

- 只是为了渲染 UI 的结构化补充信息
- 每轮都必须稳定出现，不应依赖 agent 是否刚好调用
- 本质上不是“动作”，只是消息的补充数据

在 NexusNote 中：

- quick replies / options 优先视为 assistant 消息的结构化部分
- `nextFocus`、`mode`、`confidence` 等元信息优先视为 data part 或 metadata

## Workflow Rules

以下场景必须走 workflow，而不是直接挂在对话热路径里：

- 有副作用
- 顺序固定
- 需要重试、观测、恢复

在 NexusNote 中：

- 创建/更新课程
- 课程章节生成
- note capture 后的索引与后处理
- skills discovery

## Interview-Specific Rules

课程访谈的推荐划分如下：

- `ToolLoopAgent`: 负责正文对话、追问、流式体验
- `presentOptions` / `presentOutlinePreview` tool part: 负责 quick replies 与课程草案预览
- workflow / action route: 负责真正创建或更新课程

课程访谈不应退回到“纯 prompt 约束”的模式。需要代码级约束的地方：

- 何时允许生成大纲
- 大纲预览是否满足最小质量要求
- 点击“生成课程”后的副作用执行

## Preferred Implementation Order

实现一个新的 AI 交互能力时，按这个顺序判断：

1. 这是不是开放式对话？
2. 这是不是一个真实动作？
3. 这是不是固定顺序的后台流程？
4. 这是不是只是 UI 的结构化补充数据？

映射规则：

- 开放式对话 -> `ToolLoopAgent`
- 同轮结构化 UI 结果或真实动作 -> tool / tool part
- 固定后台流程 -> workflow
- UI 补充数据 -> `UIMessage.data part`

## Anti-Patterns

以下做法在本项目里视为反模式：

- 为了方便，把结构化数据塞进普通文本里再解析
- 让前端根据自然语言自行猜测 options 或状态
- 把 UI 补充数据误建模成“可选 tool”，导致 agent 不调用就没有 UI
- 把固定后台流程强行塞进对话热路径
- 用 prompt 去硬顶业务约束，而不是用代码约束

## Practical Rule of Thumb

一句话判断：

- 对话推进，用 agent
- 真正动作，用 tool
- 固定副作用，用 workflow
- 富 UI 数据，用 `UIMessage.parts`

这条规则优先于“先写一个能跑的 hack”。

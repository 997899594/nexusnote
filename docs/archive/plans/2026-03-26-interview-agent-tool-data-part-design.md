# Interview Agent / Tool / Data Part Design

## 背景

NexusNote 的课程访谈不是普通聊天。

它同时要求：

- 真流式文本体验
- 每轮稳定出现快捷选项
- 选项必须是真实 AI 产物，不是前端伪造
- 课程创建/更新必须可控，不能因为模型一时发挥直接落库

此前有两条路径都暴露了问题：

1. 纯 `ToolLoopAgent + suggestOptions tool`
   - 快
   - 真流式
   - 但 agent 有时不会调用 `suggestOptions`
   - 结果某些轮次没有选项

2. 每轮 `state extraction + structured object stream`
   - 协议更硬
   - 但慢
   - 对 provider / structured parsing 稳定性要求高
   - 体验不像真实文本流

目标不是在两条错误路径里二选一，而是保留两边正确的部分。

## 最终划分

### 1. Agent

访谈正文由 `ToolLoopAgent` 驱动。

Agent 负责：

- 追问什么
- 如何自然表达
- 什么时候尝试确认大纲

Agent 不负责：

- 保证选项是否出现
- 直接决定课程是否应该落库

原因：

- 对话推进是不确定路径，适合 agent
- 真流式文本体验是访谈热路径的第一优先级
- chat model 在这个场景里比 pro/structured output 更合适

### 2. Tool

`confirmOutline` 是 interview 唯一核心 tool。

它是 tool，因为它代表真实业务动作：

- 生成或更新课程大纲
- 触发课程 workflow
- 带副作用

`confirmOutline` 执行前必须做：

1. `extractInterviewState()`
2. `evaluateInterviewSufficiency()`
3. `validateOutlineForState()`

如果不满足条件：

- 不落库
- 返回结构化失败结果
- agent 根据失败原因继续追问

### 3. Data Part

快捷选项不是 tool，应该是 data part。

原因：

- 选项不是能力调用
- 选项不是业务动作
- 选项是“本轮 assistant 回复的结构化 UI 补充”

因此 options 的正确形式是：

- 服务端 authoritative data
- 作为 `data-interviewOptions` 注入 UI message stream
- 前端只渲染，不发明内容

这和“前端兜底假选项”完全不同。

### 4. Workflow

课程创建/更新属于 workflow，不属于 agent。

原因：

- 步骤固定
- 带副作用
- 需要可重试和可观测

所以 interview 的职责是：

- 推进对话
- 决定是否尝试确认大纲

真正写库和课程实体更新由 workflow 完成。

## 什么时候用 agent/tool

### 用 agent + tool

当以下条件成立时：

- 下一步动作不固定
- 模型需要判断是否调用某种能力
- 对话体验重要
- 文本流很重要

适用：

- interview 正文
- learn/chat 对话
- note assistant 改写/搜索

### 不要把它做成 tool

当某个东西只是：

- 结构化 UI 信息
- 不是能力调用
- 不是业务动作
- 你又希望它稳定出现

适用：

- interview quick replies / options
- 某些 metadata / status / side info

### 用 workflow

当一个过程：

- 有副作用
- 顺序固定
- 需要可重试 / 可恢复

适用：

- create course
- generate section
- note 索引与后台处理

## “又快又对”是否成立

可以，但不是自动成立。

这套设计要同时满足两个条件：

### 快

来自：

- 访谈热路径使用 chat model
- 正文使用 agent 真流式
- 不再每轮先跑完整 structured object generation

### 对

来自：

- `confirmOutline` 前的 soft gate
- outline validation
- options 不再依赖 agent 是否恰好调用某个 tool

也就是说：

- 快，不是因为少了约束
- 对，不是因为把所有东西都做成结构化输出

正确做法是：

- 对话热路径尽量轻
- 业务约束放在真正有副作用的边界上

## 当前实现要求

当前和后续实现必须遵守这些规则：

1. interview 热路径默认使用 `interactive-fast`
2. interview 正文使用 agent UI stream
3. `confirmOutline` 是唯一 interview tool
4. `suggestOptions` 不能回到 tool 形态
5. options 必须由服务端生成并注入 stream
6. 前端只能渲染 options，不能生成假选项
7. workflow 只在 `confirmOutline` 成功后触发

## 当前剩余技术债

这套设计方向已经确定，但还有几个实现债需要继续收：

1. interview stream 完成态和错误态需要更稳，避免 `finishStatePromise` 类似悬挂
2. provider fallback 不能绕过 JSON middleware
3. interview eval 需要对齐真实生产链路，而不是旧的 structured turn 路径
4. options 生成仍是第二次模型调用，后续可继续优化

## 结论

NexusNote 的 interview 正确架构不是：

- 全部 tool
- 全部 structured object
- 全部前端控制

而是：

- `Agent` 负责对话推进
- `Tool` 负责真实动作
- `Data Part` 负责结构化 UI 补充
- `Workflow` 负责课程副作用流程

这是当前项目里最现代、最稳定、也最符合 AI SDK v6 能力边界的方案。

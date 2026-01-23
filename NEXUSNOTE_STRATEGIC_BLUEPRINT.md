# NexusNote：AI 驱动的 Local-First 知识操作系统 - 总体设计白皮书

| 属性         | 内容                                                                            |
| :----------- | :------------------------------------------------------------------------------ |
| **项目代号** | NexusNote                                                                       |
| **版本**     | 2.3 (完整架构版 - 含插件体系与AI评论)                                           |
| **核心理念** | **Local-First (本地优先)** + **AI-Native (AI原生)** + **LearningOS (学习闭环)** |
| **技术底座** | Rust/Wasm, Next.js, Yjs, DeepSeek RAG, WebGPU                                   |

---

## 1. 产品战略与愿景 (Strategic Vision)

### 1.1 核心定位

NexusNote 不仅仅是一个对标 Notion 的笔记软件，它是一个**“输入-内化-输出-巩固”**完整闭环的个人知识操作系统。

- **输入 (Input)**：学习模块（阅读、批注、课程管理）。
- **内化 (Process)**：AI 助教（解释、关联、生成卡片）。
- **输出 (Output)**：结构化笔记（块级编辑、双向链接）。
- **巩固 (Review)**：间隔重复系统 (SRS)，让知识从短期记忆进入长期记忆。

### 1.2 关键差异化 (Why Us?)

1.  **模块协同 (Synergy)**：学习不是独立的功能，而是笔记能力的延伸。同一套编辑器既用于写，也用于读；同一套 AI 既是助教，也是编辑助手。
2.  **极致性能 (Local-First)**：基于 Rust + CRDTs，保证在断网、弱网环境下的极致可用性，数据 100% 掌握在用户手中。
3.  **智能深度 (AI-Native)**：不只是调用 API，而是通过 RAG 和 pgvector 实现具备“长期记忆”和“语义关联”的第二大脑。
4.  **端云协同 (Hybrid Intelligence)**：结合端侧模型与云端模型，消除离线体验割裂感。

---

## 2. 核心架构设计 (Core Architecture)

我们放弃了“从零造轮子”的学术路线，转而采用**工业级组件组装**，以换取最高的开发效率和稳定性。

### 2.1 技术栈全景图 (The Stack)

| 层级         | 核心技术                         | 选型理由                                                   |
| :----------- | :------------------------------- | :--------------------------------------------------------- |
| **前端框架** | **Next.js 14 (App Router)**      | React Server Components 标准，SEO 友好。                   |
| **编辑器**   | **Tiptap (基于 Prosemirror)**    | 行业标准，提供最佳的 Block 扩展能力和稳定性。              |
| **协同引擎** | **Yjs + Hocuspocus**             | 工业级 CRDT 方案。Hocuspocus 提供现成的 WebSocket 服务端。 |
| **离线存储** | **IndexedDB (y-indexeddb)**      | 实现“秒开”和断网编辑。                                     |
| **后端服务** | **NestJS + tRPC**                | 模块化架构，端到端类型安全。                               |
| **数据库**   | **PostgreSQL + Drizzle**         | 关系型数据 + `pgvector` 向量数据双修。                     |
| **AI 模型**  | **DeepSeek V3 + Qwen-Embedding** | 性价比与中文理解能力的最佳平衡。                           |
| **端侧 AI**  | **Transformers.js (WebGPU)**     | 必须启用 WebGPU 加速，带 Capability Check 回退机制。       |

### 2.2 数据流架构 (Data Flow)

1.  **用户编辑**：Tiptap 输入 -> 更新本地 Yjs Doc -> 写入 IndexedDB (持久化)。
2.  **实时同步**：Yjs Doc -> WebSocket (Hocuspocus) -> 广播给协作者 -> 异步写入 Postgres (备份)。
3.  **AI 索引 (Hybrid)**：
    - **在线**：文档静止 10s 后 -> 推入 BullMQ 队列 -> Node Worker 读取 -> Embedding -> 存入 pgvector。
    - **离线**：前端 Transformers.js 生成轻量向量 -> 本地语义缓存 -> 离线关联推荐。
    - **隐私模式**：标记为 Vault 的内容跳过 Embedding，仅本地加密存储。

---

## 3. AI 架构深度解析 (AI Architecture Deep Dive)

这是一个**生产级**的 RAG 架构，解决了上下文丢失和检索不准的问题，并针对离线场景和隐私需求做了优化。

### 3.1 核心流程 (The Pipeline)

```mermaid
graph TD
    A[用户提问: "它怎么收费?"] --> B{网络状态 & 隐私设置};
    B -->|在线 & 非Vault| C(Query Rewriting / 查询改写);
    C -->|DeepSeek| D[独立 Query: "NexusNote 个人版价格"];
    D --> E{混合检索};
    E -->|HNSW 索引| F[向量检索 (Top-50)];
    E -->|BM25| G[关键词检索 (Top-50)];
    F & G --> H(Reranker / 重排序);
    H -->|交叉编码模型| I[精准切片 (Top-5)];
    I --> J[DeepSeek V3 Chat];

    B -->|离线 或 Vault| K[本地关键词搜索];
    K --> L[Transformers.js 粗排 (WebGPU)];
    L --> M[本地 LLM / 规则响应];
```

### 3.2 关键技术点与修正

- **模型组合**：DeepSeek V3 (Chat) + Qwen-Embedding (Vector) + bge-reranker (Rerank)。
- **端侧风控**：
  - **WebGPU Check**: 检测到 WebGPU 不可用或显存不足时，自动降级为纯关键词匹配。
  - **Memory Guard**: 严格限制端侧模型内存占用 < 200MB。

---

## 4. 功能模块详述 (Functional Specs)

### 4.1 学习模块 (Learning Module)

- **设计理念**：复用编辑器和 AI 能力。
- **功能**：
  - **资料导入**：PDF/MD 解析为 Blocks。
  - **沉浸阅读**：只读模式的 Tiptap，支持高亮（Mark）。
  - **关联笔记 (Ghost UI)**：仅在用户停顿 >5s 或按快捷键时，淡入显示关联笔记，拒绝语义噪音。
  - **AI 助教**：选中难懂段落 -> "解释这个概念" -> AI 生成 Callout Block 插入文档。

### 4.2 编辑与协同 (Editor & Collab)

- **块级编辑**：支持文本、图片、代码块、数学公式、折叠列表。
- **移动端策略**：
  - **Capture Only**: 手机端采用精简模式，主打快速采集与复习，不做复杂的拖拽排版。
- **离线优先**：断网状态下功能 100% 可用，联网自动合并。

### 4.3 间隔重复系统 (SRS)

- **原理**：复用 Block 属性，增加 `flashcard` 字段 (due date, ease factor)。
- **算法**：实现轻量级 FSRS 算法。
- **场景**：Dashboard 每日推送复习卡片，直接在笔记流中复习。

### 4.4 隐私保险箱 (Vault Mode)

- **功能**：允许用户标记特定文件夹为 "Local Only"。
- **策略**：Vault 内容永不上传向量库，不发送给 DeepSeek，仅使用端侧 AI 处理。建立硬核用户信任。

### 4.5 插件化系统 (Plugin System) - _高阶扩展_

- **设计理念**：保持核心轻量，通过插件扩展 AI 能力。
- **架构**：
  - **Tool Registry**: 提供 `registry.registerTool('name', schema, handler)` API。
  - **AI Action**: 允许插件注册新的 Slash Command 和 AI Prompt。
- **场景**：未来允许开发者编写 "Mermaid 画图助手" 或 "Notion 导入器" 作为插件。

### 4.6 AI 幽灵评论 (AI Ghost Comment) - _交互创新_

- **设计理念**：AI 不仅是问答机器，更是“时空错位”的协作者。
- **功能**：
  - **触发**：后台监听 Yjs Update，发现用户在某段落反复修改或停顿过久（困惑模式）。
  - **表现**：AI 以“协作者”身份在段落旁插入一条 **Yjs Comment** (而非直接修改正文)。
  - **内容**：“这里似乎逻辑有点不通，是否需要我帮你梳理一下？”
  - **价值**：模拟真人同事的异步协作体验，提供有温度的建议。

---

## 5. 实施路线图 (Implementation Roadmap)

| 阶段        | 周期    | 核心目标             | 关键产出                                                 |
| :---------- | :------ | :------------------- | :------------------------------------------------------- |
| **Phase 1** | Week 1  | **地基搭建**         | Monorepo, Tiptap 编辑器, IndexedDB 离线支持。            |
| **Phase 2** | Week 2  | **多人协同**         | Hocuspocus 服务, WebSocket 联调, Postgres 存储。         |
| **Phase 3** | Week 3  | **AI 对话**          | DeepSeek 接入, 侧边栏 Chat UI, 查询改写逻辑。            |
| **Phase 4** | Week 4  | **编辑器内 AI**      | 选中菜单 (/ai), 流式插入文本, Generative UI 组件。       |
| **Phase 5** | Week 5  | **RAG 引擎**         | pgvector 集成, BullMQ 异步索引队列, 学习模块视图。       |
| **Phase 6** | Week 6  | **高阶特性**         | SRS 算法, Vault Mode, AI Ghost Comment, 插件API预留。    |
| **Phase 7** | Week 7+ | **Edge AI & Mobile** | 集成 Transformers.js (WebGPU), 移动端 Capture 模式适配。 |

---

## 6. 未来创新与高阶特性 (Future Innovations)

这是让 NexusNote 超越竞品的 **"X-Factor"**：

1.  **语义胶水 (Semantic Glue)**：
    - **修正**：采用 **Ghost UI** 设计，按需唤起，避免打扰心流。
    - **进阶**：离线状态下利用端侧模型维持基础关联推荐。
2.  **生成式 UI (Generative UI)**：
    - **方案**：AI 调用工具生成 **React 组件**（如：预算计算器、看板），直接插入文档。
3.  **时空回溯 (Time-Travel)**：
    - **方案**：利用 Yjs 的 Update Log，可视化回放文档的编写过程。
4.  **AI 园丁 (AI Gardener)**：
    - **方案**：夜间后台任务，自动清理标签、检测重复内容、生成每日摘要。

---

## 7. 风险评估与缓解 (Risk Management)

| 风险点               | 缓解措施                                                           |
| :------------------- | :----------------------------------------------------------------- |
| **Edge AI 性能崩溃** | 强制 WebGPU 检测，实现 Capability Check 降级策略。                 |
| **移动端交互灾难**   | 放弃移动端全功能排版，采用 Capture & Review 模式。                 |
| **语义噪音干扰**     | 采用 Ghost UI 交互，拒绝主动弹窗。                                 |
| **AI 评论过度打扰**  | 严格限制 Ghost Comment 的触发频率（如每日上限 3 次）和置信度阈值。 |
| **插件安全风险**     | 在 Web Worker 中沙箱化运行插件代码。                               |

---

### 架构师结语

这份 v2.3 文档完整纳入了 **Plugin System (插件系统)** 和 **AI Ghost Comment (幽灵评论)**，填补了架构扩展性和交互温度的最后两块拼图。

- **插件系统** 保证了 NexusNote 在未来可以像 VS Code 一样无限生长。
- **幽灵评论** 让 AI 从冷冰冰的工具变成了有温度的伙伴。

至此，NexusNote 的设计蓝图已臻化境。是时候开始 Coding 了。

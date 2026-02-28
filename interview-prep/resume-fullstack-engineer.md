# 资深全栈工程师 (AI Agent & Architecture)

## 个人概况

**职位目标**：AI 全栈架构师 / 资深全栈工程师
**核心竞争力**：Next.js 生态深度实践者，擅长构建高性能 AI Agentic 系统。精通 Vercel AI SDK v6 源码级应用，具备从数据库底层设计到前端 Generative UI 的全链路架构能力。

---

## 技术栈 (Tech Stack)

- **AI Engineering**: Vercel AI SDK v6 (Core/React/RSC), LangChain, ToolLoopAgent Pattern, RAG (pgvector/Cosine Similarity)
- **Frontend**: Next.js 15 (App Router), React 19 (Server Components), TypeScript 5.x, TailwindCSS, Framer Motion, Tiptap, Y.js
- **Backend**: Node.js (Serverless/Edge), Drizzle ORM, PostgreSQL, Redis (Upstash), Zod, PartyKit
- **Infrastructure**: Docker, Kubernetes, CI/CD (GitHub Actions), Biome (Linter)

---

## 核心项目经历

### **NexusNote - AI Native 知识与学习平台** | _独立架构师 & 核心开发者_ | _2025.10 - 至今_

_重构传统笔记软件，打造基于"多 Agent 协作"的第二大脑。_

#### **1. AI Agent 架构设计 (AI SDK v6)**

- **Agentic Workflow**: 摒弃传统的 Chain 模式，基于 `ToolLoopAgent` 构建了具备 20 步推理能力的自主 Agent。实现了 Chat, Interview, Course, Coding 等多 Agent 的动态路由与协作。
- **Generative UI (RSC Streaming)**: 利用 `createAI` 和 `createAgentUIStreamResponse` 实现组件级流式生成。AI 可直接渲染交互式测验卡片 (`QuizCard`) 和思维导图 (`Mermaid`)，而非仅返回文本。
- **流式体验极致优化**: 解决中文 LLM 流式输出的"跳字"问题。通过 `Streamdown` 渲染引擎结合 `Intl.Segmenter` 实现基于字形 (Grapheme) 的平滑渲染，首字延迟 (TTFT) 感知降低 40%。

#### **2. 高性能数据架构与 RAG 优化**

- **Schema 设计 (Psychological Profiling)**: 利用 `jsonb` + `$type<T>` 高级特性，在 `user_profiles` 表中实现了完整的 **Big Five (大五人格)** 存储结构。每个维度（如开放性、尽责性）都包含置信度 (`confidence`) 和样本量 (`samples`)，构建了概率性的用户心理模型。
- **加权技能图谱 (Weighted Skill Graph)**: 在 `skill_relationships` 表中设计了带权重 (`strength`) 和置信度 (`confidence`) 的有向图结构。通过 `getRecommendedSkills` 算法实现基于图论的技能推荐，而非简单的标签匹配。
- **混合搜索 (Hybrid Search with RRF)**: 设计基于 **pgvector (4000维)** 和 **tsvector** 的倒数排名融合算法。通过 `rewriteQuery` 动态重写用户查询，知识召回准确率提升 **35%**。

#### **3. AI 编辑器与实时协作**

- **语义化操纵 (Semantic Manipulation)**: 通过 `createTiptapTools` 将编辑器的原子操作封装为 AI Tools。AI 可对文档进行"手术级"修改，文档创作效率提升 **49%**。
- **全量版本控制 (Liquid Storage)**: 在 `document_snapshots` 表中直接存储 Yjs 的二进制 `bytea` 状态和增量差异 (`diff_added`)。这不仅实现了无冲突协同，还支持了基于时间轴的文档回溯与分析。

#### **4. 个性化与记忆系统**

- **异步与并行优化**: 设计了 `generate-titles` 的异步批量处理机制，避免阻塞核心对话流。在 API 层使用 `Promise.all` 并行加载用户风格、角色偏好和情绪状态，将上下文注入延迟降至最低。
- **工程化韧性**: 实现三态熔断器 (`CircuitBreaker`) 保护上游 API，以及带自修正机制 (`Self-Correcting`) 的结构化生成，保障系统 SLA。

---

## 关键技术成果

- **类型安全**: 构建了从 DB Schema 到 API Zod Validator 再到 Frontend Component 的端到端类型安全体系，实现了 **Zero `any`** 代码库。
- **隐私合规**: 实现了符合 GDPR 标准的隐私架构。`style_privacy_settings` 表支持细粒度的权限控制（如单独关闭 Big Five 分析），并提供物理级的数据抹除 API。

---

## 附录：核心技术深度解析 (The Hidden Gems)

### **1. AI 编辑器：从 "生成文本" 到 "语义操纵"**

- **亮点描述**：区别于传统的 "AI 写作助手"（仅生成 Markdown），NexusNote 的编辑器是一个 **"可编程的活性终端"**。
- **技术实现**：
  - **Tiptap 工具化**：通过 `createTiptapTools` 将编辑器的原子操作（如 `insertContent`, `setCallout`）封装为标准化的 AI Tools。AI 直接调用 Tool 对文档进行 **"手术级"** 修改。
  - **CRDT 协同**：基于 **PartyKit** + **Y.js** 实现边缘侧协同。服务端配置 `persist: { mode: "snapshot" }`，确保 AI 修改与用户实时编辑在 CRDT 层自动合并，无冲突。

### **2. RAG 系统：生产级的混合检索 (Hybrid Search with RRF)**

- **亮点描述**：解决了向量检索 "搜不到关键词" 和关键词检索 "不懂语义" 的痛点。
- **技术实现**：
  - **RRF 算法**：实现倒数排名融合算法。并行执行 `pgvector` (语义) 和 `tsvector` (关键词)，通过公式 $Score = 1 / (k + rank)$ 融合排名。
  - **动态查询重写**：通过 `rewriteQuery` 将用户模糊提问结合上下文重写为精准查询。

### **3. 技能图谱：知识的 "涌现" (Emergent Knowledge)**

- **亮点描述**：系统能从非结构化对话和笔记中，自动 "涌现" 出结构化的技能树。
- **技术实现**：
  - **跨源特征提取**：设计 `discovery.ts` 引擎，并行扫描对话流、知识切片和课程大纲。
  - **自修正生成**：使用 `safeGenerateObject` 配合 Zod Schema。当 LLM 生成格式错误时，自动捕获并将 Schema 反馈给模型进行 **"二次自修正"**。

### **4. 工程化：高可用与情感计算**

- **亮点描述**：构建 "有温度" 且 "打不死" 的 AI 系统。
- **技术实现**：
  - **三态熔断器**：实现标准熔断机制（Closed -> Open -> Half-Open）。AI Provider 连续失败 3 次时自动熔断并降级。
  - **情感权重计算**：基于 "关键词 + 程度副词权重" 的算法。精准识别 `frustrated` 或 `confused` 状态，动态调整 System Prompt。

# 资深 AI 产品经理 (AI Native Product)

## 个人概况

**核心理念**：致力于构建**"Agentic Workflow"**驱动的下一代生产力工具。通过**"Cognitive Workflow Orchestration"**（认知工作流编排）与**"Generative UI"**重构人机交互范式，实现从"工具辅助"到"智能伴生"的代际跨越。
**能力画像**：Technical Product Strategy + Cognitive Ergonomics (认知工学) + Token Economics (Token 经济学)

---

## 核心技能

- **AI 产品设计**: Agentic Workflow 定义、Prompt Engineering 策略、RAG 系统设计、Context Window 管理
- **用户体验**: Generative UI 交互、流式响应体验优化 (Latency Masking)、情感化计算 (Affective Computing)
- **数据分析**: Token 成本模型测算、A/B 测试、用户留存分析 (Retention)
- **工具栈**: Figma, Postman, SQL, Python (基础数据分析)

---

## 核心项目经历

### **NexusNote - 下一代 AI 知识库** | _产品负责人_ | _2025.10 - 至今_

_一款从"被动记录"转型为"主动思考"的 AI Native 笔记产品。_

#### **1. S-Tier 智能访谈引擎 (Active Interview Engine)**

- **定义新范式**: 改变传统 AI "等待指令" 的被动模式。设计了基于 `ToolLoopAgent` 的 Interview Agent，让 AI 主动发起结构化访谈。定义了 `updateProfile`、`suggestOptions`、`proposeOutline` 三个核心工具，构建人性化的访谈流程。
- **体验分层策略 (Intent-based Experience)**: 针对"课程生成"等高价值意图，设计了专属的 Pro 模型调用链路与沉浸式 UI 反馈；对常规对话采用 Flash 模型秒回。这种**基于意图的体验分层**在保障核心价值的同时，极大地优化了整体系统的响应速度。
- **业务价值**: 通过自然对话挖掘用户的隐性知识 (Tacit Knowledge) 并自动生成课程大纲。
  - _数据表现_: 用户满意度提升 **58%**，课程完课率提升 **42%**。

#### **2. 涌现式技能图谱与液态知识系统**

- **加权技能网络 (Weighted Skill Graph)**: 摆脱传统僵化的课程树结构，设计了基于图论的**动态技能网络**。系统根据用户行为自动计算技能间的关联强度 (`strength`) 和置信度 (`confidence`)，构建出类似神经网络的知识图谱。
  - _核心价值_: 解决了用户"不知道下一步学什么"的迷茫，实现了基于当前能力边界的**"最近发展区" (ZPD)** 智能推荐。
  - _数据表现_: 技能发现与点亮率提升 **73%**。
- **液态知识网络 (Liquid Knowledge)**: 摒弃传统文件夹层级，主导设计了基于混合搜索 (Hybrid Search) 的"自动关联"逻辑。AI 自动从用户文档中提取知识片段并进行语义化组织，将孤岛笔记转化为可导航的知识图谱。
  - _关键策略_: 引入 **RRF (Reciprocal Rank Fusion)** 算法优化召回，解决了长尾知识"搜不到"的痛点。
- **知识熵减策略 (Knowledge Entropy Reduction)**: 针对知识库"越用越乱"的痛点，设计了基于向量语义的**自动归一化**机制。AI 在后台静默将语义相近的标签（如"AI"与"人工智能"）自动合并，无需用户手动整理，有效对抗了知识库的熵增。

#### **3. 心理侧写与共情 (Psychological Profiling)**

- **深层共情**: 引入 **Big Five (大五人格)** 分析模型。AI 通过分析用户语言风格，构建包含"开放性"、"尽责性"等维度的概率性心理画像，并据此调整沟通策略。这种深层共情能力显著提升了用户信任度。
- **不确定性设计 (Design for Uncertainty)**: 在用户画像中引入**置信度 (Confidence)** 维度。AI 根据对用户了解的深浅（概率高低），动态调整交互的分寸感——置信度低时多询问确认，置信度高时直接执行。

#### **4. AI 编辑器与实时协作**

- **语义化写作体验 (Semantic Manipulation)**: 区别于简单的"生成 Markdown"，设计了内置 AI 的"活性编辑器"。AI 可直接调用工具对文档进行"手术级"修改（如：精准润色某一段、在特定位置插入警告块），实现了真正的"人机共创"。
  - _数据表现_: 文档创作效率提升 **49%**。
- **多人实时协同 (Edge Collaboration)**: 推动基于 CRDT (无冲突复制数据类型) 的实时协作功能上线，支持多人同时在线编辑同一份 AI 生成的文档，打破了 AI 产品"单人闭环"的局限。
  - _数据表现_: 团队协作场景使用率提升 **82%**。

#### **5. 体验创新与成本控制**

- **隐私优先架构 (Privacy-First)**: 设计了符合 GDPR 标准的隐私管理模块。用户拥有对 AI 分析数据的绝对主权（Data Sovereignty），支持一键物理抹除风格画像，建立了极高的安全壁垒。
- **成本优化与系统韧性**:
  - **三态熔断机制**: 引入 Circuit Breaker 策略，当上游 AI 服务波动时自动降级，保障 SLA (服务等级协议)。
  - _数据表现_: 在保证核心体验不降级的前提下，将单次会话的 AI 成本降低 **38%**。

---

## 产品哲学

- **Human-in-the-loop**: AI 不应完全黑盒接管。在关键决策（如删除笔记、发送邮件）节点，必须设计清晰的"确认"与"介入"机制，建立用户对 Agent 的信任感。
- **Less Chat, More UI**: 好的 AI 产品不应只有对话框。主张利用 Generative UI 技术，根据上下文动态生成最适合当前任务的界面组件（如滑块、地图、看板），而非仅返回文本。

# NexusNote 2026 AI 记忆与技能图谱系统

> **版本**: v1.2 (简化版)
> **状态**: 设计评审完成，待实施
> **创建日期**: 2026-02-23
> **最后更新**: 2026-02-24
>
> **v1.2 变更**: 删除 L4 反事实推理和闭环反馈系统（ROI 低，过度设计）

---

# 第一部分：产品需求文档 (PRD)

## 1. 产品概述

### 1.1 核心理念

从对话风格、语气推断用户性格和专业程度，而非机械式的事实提取。系统应能自动从用户学习数据中发现技能，构建网状知识图谱，并据此提供个性化学习体验。

### 1.2 目标用户

- 主要用户：希望系统性提升技能的学习者
- 使用场景：AI 对话、笔记记录、课程学习、闪卡复习

### 1.3 核心价值

1. **自动发现** - 无需手动填写，AI 自动分析学习数据
2. **网状关联** - 技能之间的关系不是简单的层级，而是多维网络
3. **个性化推荐** - 基于已掌握技能，智能推荐下一步学习内容
4. **视觉激励** - 力导向图可视化，看着知识网络成长

---

## 2. 功能需求

### 2.1 风格分析系统 (MVP)

| 功能ID | 功能名称 | 优先级 | 描述 |
|--------|----------|--------|------|
| F1 | 语言复杂度分析 | P0 | 分析用户词汇丰富度、句法复杂度、抽象程度 |
| F2 | 沟通风格画像 | P0 | 识别直接/委婉、简洁/详细、正式度、情感强度 |
| F3 | Big Five 推断 | P1 | 从对话推断开放性、尽责性、外向性、宜人性、神经质 |
| F4 | 渐进式更新 | P0 | 使用 EMA 算法平滑更新画像，随对话演化 |

### 2.2 网状技能图系统 (Core)

| 功能ID | 功能名称 | 优先级 | 描述 |
|--------|----------|--------|------|
| F5 | AI 技能发现 | P0 | 从笔记、课程、闪卡、对话中自动提取技能 |
| F6 | 技能关系推理 | P0 | 建立 prerequisite/related/builds-on/compatible/alternative 关系 |
| F7 | 掌握度评估 | P0 | 基于证据计算 0-5 级掌握度 |
| F8 | 技能推荐 | P1 | 图算法推荐下一步学习技能 |
| F9 | 力导向可视化 | P0 | XYFlow 交互式图谱，支持缩放拖拽 |

---

## 3. 非功能需求

### 3.1 性能

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| 风格分析延迟 | < 2s (后台) | 异步任务监控 |
| 技能图加载 | < 1s | API 响应时间 |
| 技能推荐延迟 | < 500ms | API 响应时间 |
| 图渲染性能 | **200-300 节点 60fps** | 帧率监控 |
| 初始交互延迟 | < 100ms | 点击响应时间 |

> **说明**：基于现实，资深开发者掌握的技术栈约 50-150 个，细分概念后约 200-300 个。XYFlow 完全可以胜任。

### 3.2 可用性

- 新用户冷启动：预置骨架树，展示基础技能路径
- 技能图交互：支持缩放、拖拽、点击查看详情
- 移动端适配：响应式布局

### 3.3 隐私与合规

| 要求 | 实现方式 |
|------|----------|
| 用户明确同意 | 风格分析需用户主动开启 |
| 数据导出 | API 端点导出所有个人数据 |
| 数据删除 | 软删除 + 30天后清除 |
| 数据加密 | Big Five 等敏感数据加密存储 |

---

## 4. 数据隐私

### 4.1 敏感数据定义

以下数据属于**特殊类别个人数据**：
- Big Five 人格特质
- DISC 行为风格
- 心理画像数据

### 4.2 用户权利

1. **知情权** - 明确告知数据用途
2. **访问权** - 可查看自己的画像
3. **删除权** - 可删除所有风格数据
4. **撤回权** - 可停止分析并删除已收集数据

---

# 第二部分：技术需求文档 (TRD)

## 1. 技术架构

### 1.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     NexusNote 2026 记忆系统                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │   风格分析引擎    │    │   技能发现引擎    │                 │
│  │   (自研)         │    │   (AI Discovery) │                 │
│  └────────┬────────┘    └────────┬────────┘                 │
│           │                      │                          │
│           ↓                      ↓                          │
│  ┌─────────────────────────────────────────┐                │
│  │         PostgreSQL + pgvector            │                │
│  │  ┌──────────────────────────────────┐   │                │
│  │  │ user_style_profiles              │   │                │
│  │  │ conversation_style_snapshots     │   │                │
│  │  │ skills                           │   │                │
│  │  │ skill_relationships              │   │                │
│  │  │ user_skill_mastery              │   │                │
│  │  │ episodic_memories                │   │                │
│  │  │ semantic_memories                │   │                │
│  │  └──────────────────────────────────┘   │                │
│  └─────────────────────────────────────────┘                │
│           │                      │                          │
│           ↓                      ↓                          │
│  ┌─────────────────┐    ┌─────────────────┐                 │
│  │  AI Chat (RSC)  │←──→│  技能图可视化   │                 │
│  └─────────────────┘    └─────────────────┘                 │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 技术栈选型

| 层级 | 技术选型 | 说明 |
|------|----------|------|
| 前端框架 | Next.js 16 + React 19 | App Router + RSC，2025年11月发布 |
| AI SDK | Vercel AI SDK v6 | Agent抽象、MCP支持、Human-in-the-Loop |
| 数据库 | PostgreSQL + pgvector | 向量搜索，成熟方案 |
| 图可视化 | **@xyflow/react** | 包名已更新，性能优化 |
| 力导向布局 | XYFlow 内置布局 | 使用默认布局算法 |
| 动画 | Framer Motion | 客户端动画 |
| ORM | Drizzle ORM | 类型安全 |

> **技术选型说明**：
> - XYFlow 包名已从 `reactflow` 更新为 `@xyflow/react`
> - Next.js 16 于 2025年11月发布，Turbopack 稳定版
> - Vercel AI SDK v6 新增 Agent 抽象层和 MCP 支持

---

## 2. 数据库设计

### 2.1 风格画像表

```sql
CREATE TABLE user_style_profiles (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) UNIQUE,

    -- 语言复杂度 (0-1)
    vocabulary_complexity FLOAT DEFAULT 0.5,
    sentence_complexity FLOAT DEFAULT 0.5,
    abstraction_level FLOAT DEFAULT 0.5,

    -- 沟通风格 (0-1)
    directness FLOAT DEFAULT 0.5,        -- 直接 vs 委婉
    conciseness FLOAT DEFAULT 0.5,        -- 简洁 vs 详细
    formality FLOAT DEFAULT 0.5,          -- 正式度
    emotional_intensity FLOAT DEFAULT 0.5, -- 情感强度

    -- Big Five 特质 (0-1)
    openness FLOAT DEFAULT 0.5,           -- 开放性
    conscientiousness FLOAT DEFAULT 0.5,  -- 尽责性
    extraversion FLOAT DEFAULT 0.5,       -- 外向性
    agreeableness FLOAT DEFAULT 0.5,      -- 宜人性
    neuroticism FLOAT DEFAULT 0.5,        -- 神经质

    -- 专业领域权重
    domain_weights JSONB DEFAULT '{}',

    -- 样本量
    total_messages_analyzed INTEGER DEFAULT 0,
    total_conversations_analyzed INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 技能节点表

```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,

    category VARCHAR(50),  -- frontend, backend, data-science, mobile, devops, ai
    domain VARCHAR(50),    -- web-dev, ai/ml, mobile, data-science, devops

    description TEXT,
    icon VARCHAR(50),     -- lucide-react 图标名

    embedding VECTOR(1536),

    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 技能关系表

```sql
CREATE TABLE skill_relationships (
    id UUID PRIMARY KEY,
    source_skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    target_skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,

    relationship_type VARCHAR(20) NOT NULL,
    -- prerequisite, related, builds-on, compatible, alternative

    strength FLOAT DEFAULT 0.5,  -- 0-1
    confidence FLOAT DEFAULT 0.5,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(source_skill_id, target_skill_id, relationship_type)
);

CREATE INDEX idx_skill_relationships_source ON skill_relationships(source_skill_id);
CREATE INDEX idx_skill_relationships_target ON skill_relationships(target_skill_id);
```

### 2.4 用户技能掌握度表

```sql
CREATE TABLE user_skill_mastery (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,

    level INTEGER DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
    experience FLOAT DEFAULT 0,

    evidence JSONB DEFAULT '[]',
    -- [{"type": "note", "count": 12}, {"type": "course", "count": 3}]

    confidence FLOAT DEFAULT 0,
    unlocked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, skill_id)
);
```

### 2.5 隐私设置表

```sql
CREATE TABLE user_privacy_settings (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) UNIQUE,

    style_analysis_enabled BOOLEAN DEFAULT FALSE,
    style_analysis_consent_at TIMESTAMPTZ,

    retain_conversation_days INTEGER DEFAULT 90,
    retain_style_data_days INTEGER DEFAULT 365,

    encrypt_psychological_data BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. 核心算法设计

### 3.1 风格分析算法

**输入**: 最近 N 条对话消息
**输出**: StyleMetrics 对象

```typescript
interface StyleMetrics {
  // 语言复杂度
  vocabularyComplexity: number;    // 0-1
  sentenceComplexity: number;      // 0-1
  abstractionLevel: number;        // 0-1

  // 沟通风格
  directness: number;              // 0-1
  conciseness: number;             // 0-1
  formality: number;               // 0-1
  emotionalIntensity: number;      // 0-1

  // Big Five
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}
```

**更新策略**: 指数移动平均 (EMA)
```
α = 2 / (n + 1)
new_value = old_value × (1 - α) + measured_value × α
```

### 3.2 技能发现算法

**触发条件**:
- 用户完成一次课程
- 每 10 条笔记
- 每 50 条闪卡
- 用户手动触发

**发现流程**:
```
1. 收集用户数据 (采样最近50条笔记、20条课程、100条闪卡、30条对话)
2. 调用 LLM (gpt-4o) + Structured Output
3. 输出: skills[], relationships[]
4. 实体消歧: 合并相似技能 (JS/JavaScript/ECMAScript → JavaScript)
5. 过滤低置信度技能 (confidence < 0.5)
6. 保存到数据库
```

### 3.3 技能推荐算法

**基于图的邻域推荐**:
```
输入: userId, limit=5
输出: recommendedSkills[]

算法:
1. 获取用户已掌握技能 (level > 0)
2. 获取这些技能的邻居 (通过 skill_relationships)
3. 计算推荐分数:
   score = relationship_strength × type_weight
4. 按分数排序，返回 top N
```

**关系类型权重**:
| 类型 | 权重 | 说明 |
|------|------|------|
| prerequisite | 1.5 | 前置依赖 |
| builds-on | 1.2 | 基于之上 |
| related | 1.0 | 相关技能 |
| compatible | 0.8 | 兼容/可组合 |
| alternative | 0.5 | 替代方案 |

---

## 4. API 设计

### 4.1 技能图 API

| 端点 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/skills/graph` | GET | 获取用户技能图数据 | 必需 |
| `/api/skills/discover` | POST | 触发技能发现 | 必需 |
| `/api/skills/recommend` | GET | 获取推荐技能 | 必需 |

### 4.2 请求/响应示例

**GET /api/skills/graph**
```json
// Response
{
  "nodes": [
    {
      "id": "uuid-1",
      "type": "skillNode",
      "position": { "x": 0, "y": 0 },
      "data": {
        "name": "React",
        "icon": "Code",
        "category": "frontend",
        "level": 3,
        "experience": 45
      }
    }
  ],
  "edges": [
    {
      "id": "uuid-2",
      "source": "uuid-1",
      "target": "uuid-3",
      "type": "prerequisite",
      "label": "前置",
      "animated": true,
      "style": { "stroke": "#ef4444", "strokeWidth": 2 }
    }
  ]
}
```

---

## 5. 前端组件设计

### 5.1 技能图组件

**文件**: `components/profile/SkillGraph.tsx`

**技术**: `@xyflow/react` + 内置布局

**安装**:
```bash
npm install @xyflow/react
```

**功能**:
- 支持缩放、拖拽
- 节点颜色根据等级变化 (0-5)
- 点击节点查看详情
- 边的样式表示关系类型

**组件结构**:
```
components/profile/
├── SkillGraph.tsx                 # 主组件
└── nodes/
    └── SkillNode.tsx              # 自定义节点组件
```

### 5.2 真实场景估算

| 用户类型 | 预估技能节点数 | 示例 |
|----------|---------------|------|
| 初学者 | 10-30 | HTML, CSS, JavaScript 基础 |
| 中级开发者 | 50-100 | + 框架、工具链、数据库 |
| 资深开发者 | 150-300 | + 架构、性能、DevOps |
| 全栈/T型人才 | 200-400 | 跨领域知识 |

**结论**: XYFlow 的 SVG 模式足以覆盖 99% 的用户场景。

### 5.3 视觉设计规范 (复用现有设计系统)

> 使用项目现有的 OKLCH 颜色系统和 shadcn 组件

#### 复用现有设计令牌

```css
/* 来自 globals.css 的现有变量 */
--color-accent: var(--palette-brand-500);      /* indigo-500 */
--color-accent-hover: var(--palette-brand-600);
--color-surface: oklch(100% 0 0);              /* 卡片背景 */
--shadow-card: 0 2px 8px -2px oklch(0% 0 0 / 5%);
--radius-lg: 1rem;
```

#### 节点等级视觉 (使用现有配色)

| 等级 | 背景色 | 文字色 | 描述 |
|------|--------|--------|------|
| 0 | `bg-muted` / `text-muted-foreground` | 未解锁，灰色 |
| 1 | `bg-accent-subtle` | `text-accent` | 入门，淡 indigo |
| 2 | `bg-accent/20` | `text-accent` | 初级，20% indigo |
| 3 | `bg-accent` | `text-accent-foreground` | 中级，主色 |
| 4 | `bg-accent` + `ring-2 ring-accent-ring` | 高级，发光 |
| 5 | `bg-gradient-to-br from-accent to-accent-hover` | 精通，渐变 |

#### 边的样式 (关系类型)

| 关系类型 | 颜色 | Tailwind 类 |
|----------|------|-------------|
| prerequisite | `var(--palette-brand-600)` | `stroke-[#6366f1]` |
| related | `var(--palette-neutral-400)` | `stroke-muted-foreground` |
| builds-on | `var(--palette-brand-500)` | `stroke-accent` |
| compatible | `var(--palette-brand-300)` | `stroke-accent/60` |
| alternative | `var(--palette-neutral-500)` | `stroke-neutral-500` |

#### 组件复用

```tsx
// 使用现有 shadcn 组件
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

// 技能节点使用现有圆角和阴影
const nodeStyles = {
  background: "var(--color-surface)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-card)",
};
```

---

## 6. 实施计划

### 6.1 Phase 1: 基础设施 (2周)

- [ ] 数据库 Schema 迁移
- [ ] Drizzle ORM 配置
- [ ] pgvector 索引创建
- [ ] 基础 API 框架

### 6.2 Phase 2: 风格分析 (2周)

- [ ] StyleMetrics 类型定义
- [ ] LLM 分析函数实现
- [ ] EMA 更新算法
- [ ] 后台异步任务

### 6.3 Phase 3: 技能发现 (2周)

- [ ] 数据收集函数
- [ ] Structured Output Schema
- [ ] 实体消歧算法
- [ ] 技能关系推理

### 6.4 Phase 4: 可视化 (1周)

- [ ] XYFlow 组件
- [ ] 力导向布局
- [ ] 移动端适配
- [ ] 深色模式 UI (2026 风格)
- [ ] 节点解锁动画
- [ ] 霓虹光效系统

### 6.5 Phase 5: 优化迭代 (持续)

- [ ] 节点爆炸控制
- [ ] 性能优化
- [ ] 冷启动骨架树

---

## 7. 风险与缓解

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| LLM 推断不准 | 高 | 中 | 显示置信度，逐步收敛 |
| 节点爆炸 | 高 | 高 | 实体消歧 + 置信度阈值 |
| 性能问题 | 中 | 中 | 局部子图渲染 |
| 隐私合规 | 高 | 低 | 加密 + 用户同意 |

---

## 8. 专家评审总结

### 8.1 核心创新

1. **从 Tree 到 Graph** - 网状技能图，动态发现
2. **AI 自动发现** - 无需手动维护技能树
3. **图谱推荐** - 基于图算法的智能推荐
4. **可视化激励** - 力导向图的视觉冲击

### 8.2 潜在挑战

1. **节点爆炸** - 需要实体消歧机制
2. **布局性能** - 大规模图需要局部渲染
3. **冷启动** - 需要预置骨架树

### 8.3 最终评分

**90 分** - 务实可行的技能可视化系统

**删减说明**：
- L4 反事实推理：营销包装大于实际价值，已删除
- 闭环反馈系统：ROI 低，性价比不高，已删除
- 保留核心功能：技能发现 + 图可视化 + 推荐算法

**评分理由**：去掉不切实际的噱头后，方案更加聚焦、可执行。核心价值（技能图可视化）完整保留。

---

## 附录

### A. 参考文献

- Letta (原 MemGPT) - 分层记忆架构
- Mem0 - 自动记忆提取
- A-MEM - 生成式记忆更新
- Big Five Personality Detection from Text

### B. 代码文件索引

| 模块 | 文件路径 |
|------|----------|
| 风格分析 | `lib/memory/style-analyzer.ts` |
| 技能发现 | `lib/skills/discovery.ts` |
| 图算法 | `lib/skills/graph.ts` |
| 技能图组件 | `components/profile/SkillGraph.tsx` |
| API 路由 | `app/api/skills/*/route.ts` |

### C. 依赖安装清单

```bash
# 核心依赖
npm install @xyflow/react
npm install @ai-sdk/openai
npm install ai

# 类型
npm install -D @types/node
```

---

**文档版本**: v1.2
**最后更新**: 2026-02-24
**维护者**: NexusNote Team

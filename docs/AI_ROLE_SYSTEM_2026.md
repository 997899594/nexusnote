# NexusNote AI Role System 2026

更新时间：2026-04-02

## 1. 结论

NexusNote 不应该把“人设”设计成一个简单的角色列表，也不应该把它理解成一段可随意切换的 `systemPrompt`。

更现代的做法是把“角色”拆成 4 层：

1. `Assistant Identity`
2. `Capability Mode`
3. `User Preference`
4. `Presentation Skin`

其中：

- `Assistant Identity` 是产品级恒定身份
- `Capability Mode` 是任务态
- `User Preference` 是用户长期默认偏好
- `Presentation Skin` 才是狭义上的“人设皮肤”

这 4 层不能混在一起。

如果混在一起，会出现这些问题：

- 学习助手被“角色扮演”带偏
- 同一个用户在不同场景下的体验不稳定
- prompt 越堆越厚，评估和观测越来越差
- 前端只有“选角色”，没有真正的任务控制能力

所以对 NexusNote 来说，“人设系统”的正确产品名应该更接近：

- `AI 偏好`
- `AI 模式`
- `表达风格`

而不是只有“人设”两个字。

## 2. 现在这套的问题

当前实现已经有基础雏形，但抽象层级仍然偏旧。

### 2.1 当前优势

- 已有用户默认 persona 偏好持久化
- 已有内置 persona 目录
- 已有前端切换入口
- 已有 personalization 拼装链路

对应文件：

- [db/schema/personas.ts](/Users/findbiao/projects/nexusnote/db/schema/personas.ts)
- [lib/ai/personas/service.ts](/Users/findbiao/projects/nexusnote/lib/ai/personas/service.ts)
- [stores/user-preferences.ts](/Users/findbiao/projects/nexusnote/stores/user-preferences.ts)
- [components/chat/PersonaSelector.tsx](/Users/findbiao/projects/nexusnote/components/chat/PersonaSelector.tsx)
- [lib/ai/personalization.ts](/Users/findbiao/projects/nexusnote/lib/ai/personalization.ts)

### 2.2 当前核心问题

#### 问题 1：persona 和系统行为耦合过深

当前 persona 本质上是：

- 名称
- 描述
- 一段 `systemPrompt`

这意味着 persona 不只是“风格”，而是在直接参与系统行为定义。

风险：

- 它可能覆盖本来应该稳定的产品规则
- 它让能力、风格、任务边界混成一层

#### 问题 2：角色列表偏“扮演型”，不够“学习产品型”

像：

- 女朋友
- 损友
- 戈登
- Steve Jobs

这些可以作为表达皮肤存在，但不能成为核心交互架构。

对学习平台更关键的其实是：

- 讲解方式
- 启发方式
- 严厉程度
- 详细程度
- 结构化程度

#### 问题 3：缺少“任务模式”这一层

用户真正需要切的很多时候不是“谁在说话”，而是“怎么帮助我”。

例如：

- 学习时：讲解 / 追问 / 测验 / 复盘
- 笔记时：整理 / 精炼 / 改写 / 沉淀
- 职业规划时：诊断 / 路径分析 / 差距补齐

这层不建出来，角色系统一定会变成表演系统。

#### 问题 4：长期偏好和当前会话 override 没有清晰分离

现在的 `defaultPersonaSlug` 更像“全局默认角色”。

但现代产品里应该明确区分：

- 用户长期偏好
- 当前 surface 默认模式
- 当前会话临时切换

## 3. 应该放在个人页吗

答案是：

- `长期默认设置` 放个人页，正确
- `当前任务切换` 不能只放个人页，必须在任务页就地可改

### 3.1 个人页负责什么

个人页应成为 `AI Preferences` 的主入口，负责：

- 默认交流风格
- 默认解释深度
- 默认学习节奏
- 默认表达皮肤
- 是否开启实验性角色

也就是：

个人页负责“我的默认 AI 行为”。

### 3.2 聊天页 / 学习页 / 笔记页负责什么

这些任务页应提供轻量的就地切换：

- 当前模式
- 当前风格 override
- 恢复默认

用户在学习第 3 章时想切成“追问模式”，这是任务内行为，不应该逼他跳到 `/profile`。

### 3.3 推荐的信息架构

#### Profile

放：

- `AI 偏好`
- `交流风格`
- `学习偏好`
- `默认角色皮肤`
- `实验性角色管理`

#### Chat / Learn / Notes Header

放：

- 当前模式 pill
- 当前风格 pill
- 可选的角色皮肤入口

#### 首次 onboarding

问 2 到 3 个问题：

- 你喜欢 AI 更直接还是更温和
- 你喜欢更简洁还是更详细
- 你喜欢老师式还是教练式

## 4. 现代化角色系统的正确分层

### 4.1 Assistant Identity

这是 NexusNote 的恒定产品身份。

作用：

- 定义产品级价值观
- 定义事实性和安全边界
- 定义工具使用原则
- 定义与课程、笔记、沉淀、RAG 的关系

它不允许被 persona 覆盖。

例如：

- 不编造
- 优先结合当前课程上下文
- 工具结果和普通文本分离
- 删除等高风险动作必须确认

这一层应该继续放在基础 prompt / developer policy 中，而不是 persona 中。

### 4.2 Capability Mode

这是最重要的一层。

它回答的是：

“当前这个助手正在做什么工作？”

建议的一等模式：

- `learn_coach`
- `note_editor`
- `note_distiller`
- `career_guide`
- `course_interviewer`
- `general_chat`

这一层决定：

- 能用哪些工具
- 对哪些上下文敏感
- 成功标准是什么
- 输出应该偏解释、偏建议还是偏结构化

这一层应该和现有 capability profile 对齐，而不是继续让 persona 负责。

### 4.3 User Preference

这是用户长期偏好。

应该结构化存储，而不是存一整段自由 prompt。

建议字段：

- `tonePreference`
- `verbosityPreference`
- `teachingStylePreference`
- `encouragementLevel`
- `clarificationPreference`
- `preferredFormat`
- `preferredPace`

这一层只影响表达和展开方式，不改变能力边界。

### 4.4 Presentation Skin

这是狭义上的角色皮肤。

它只控制：

- 称呼方式
- 语气
- 例子偏好
- 情绪色彩
- 文案微风格

它不能控制：

- 是否搜索知识库
- 是否调用工具
- 是否保存数据
- 是否改变学习目标

这层才适合承载：

- 温柔老师
- 严格教练
- 陪伴型
- 苏格拉底
- 实验性角色皮肤

## 5. 推荐产品模型

### 5.1 不是“选一个角色”

而是：

`选择默认 AI 行为配置`

用户看到的 UI 应该是：

#### 默认模式

- 学习时默认：讲解型 / 教练型 / 追问型
- 笔记时默认：整理型 / 精炼型 / 结构化型

#### 默认表达

- 直接
- 温和
- 启发式

#### 默认深度

- 简洁
- 平衡
- 详细

#### 可选皮肤

- 标准助手
- 温柔老师
- 严格教练
- 陪伴型
- 实验性角色

### 5.2 学习产品优先级

对 NexusNote 这类产品，优先级应该是：

1. 任务模式
2. 讲解策略
3. 用户偏好
4. 角色皮肤

而不是反过来。

## 6. 数据模型建议

### 6.1 不建议继续把 persona 作为大段 prompt 仓库

当前 `personas.systemPrompt` 的问题是：

- 可审计性差
- 很难做 eval
- 很难做灰度
- 很难保证不会越权覆盖系统规则

### 6.2 建议的新模型

#### `assistant_presets`

存储“可选择的行为模板”

字段建议：

- `id`
- `slug`
- `name`
- `kind`
  - `core`
  - `style`
  - `experimental`
- `surfaceScope`
  - `global`
  - `learn`
  - `notes`
  - `career`
- `tone`
- `verbosity`
- `teachingStyle`
- `encouragementLevel`
- `socraticLevel`
- `isEnabled`
- `isExperimental`
- `presentationTemplateId`

#### `user_ai_preferences`

替代“只存默认 persona”

字段建议：

- `userId`
- `defaultGlobalPresetId`
- `defaultLearnPresetId`
- `defaultNotesPresetId`
- `tonePreference`
- `verbosityPreference`
- `preferredFormat`
- `preferredPace`
- `clarificationPreference`
- `allowExperimentalSkins`
- `updatedAt`

#### `conversation_runtime_policy`

会话级运行时配置

字段建议：

- `conversationId`
- `capabilityMode`
- `presetId`
- `skinId`
- `sessionOverride`
- `compiledPolicyVersion`
- `updatedAt`

#### `assistant_policy_events`

观测和实验用途

字段建议：

- `conversationId`
- `userId`
- `surface`
- `capabilityMode`
- `presetId`
- `skinId`
- `action`
  - `selected`
  - `overridden`
  - `reset`
- `createdAt`

### 6.3 对现有表的处理建议

不建议立刻删掉当前 `personas` 和 `user_persona_preferences`。

推荐迁移方式：

- Phase 1：保留旧表，只把 built-in persona 解释为 `presentation skin`
- Phase 2：新增 `user_ai_preferences`
- Phase 3：将运行时读取链路迁移到结构化策略
- Phase 4：把旧 `systemPrompt` 字段降级为兼容层

## 7. 运行时架构

### 7.1 当前问题

现在的链路更接近：

`basePrompt + behaviorPrompt + skinPrompt + userContext`

这会导致：

- persona 与系统规则并列
- 难以解释最终策略来源
- 很难做消息级和会话级观测

### 7.2 推荐的编译链

请求进入时，统一构建 `effective assistant policy`：

1. `system invariants`
2. `capability policy`
3. `context policy`
4. `user preference policy`
5. `session override policy`
6. `presentation skin`

最终编译为：

- `behavior policy`
- `tool policy`
- `response policy`
- `presentation policy`

### 7.3 各层职责

#### `system invariants`

始终最高优先级。

负责：

- 产品身份
- 安全边界
- 工具边界
- 不编造规则

#### `capability policy`

决定：

- 当前场景目标
- 允许工具
- 输出结构
- 成功标准

#### `context policy`

注入：

- 当前课程
- 当前章节
- 当前笔记
- 当前对话
- 当前黄金之路节点

#### `user preference policy`

决定：

- 更简洁还是更详细
- 更直接还是更温和
- 更启发还是更说明

#### `session override policy`

用于当前任务页即时切换。

例如：

- 这次先进入测验模式
- 当前对话暂时切成苏格拉底式

#### `presentation skin`

最低优先级。

只调整措辞和语气。

### 7.4 输出与 UI 契约

运行时应把这些结构化信息保留在消息元数据中，而不是只埋在文本里。

建议 message metadata 至少包含：

- `capabilityMode`
- `presetId`
- `skinId`
- `policyVersion`
- `contextScope`

这样前端、trace、eval、回放都能知道这条消息是按什么策略生成的。

## 8. 前端入口设计

### 8.1 Profile 页

新增一个独立区块：

- `AI 偏好`

子区块：

- 默认交流风格
- 默认讲解深度
- 默认学习方式
- 默认角色皮肤
- 是否展示实验性皮肤

这个区块不应只是一个 persona selector。

### 8.2 Chat 页

顶部入口应从“选人设”升级为：

- `模式`
- `风格`
- `皮肤`

默认只露出前两个，皮肤收进二级入口。

### 8.3 Learn 页

学习页最重要的不是角色，而是当前帮助方式。

推荐入口：

- `讲解`
- `追问`
- `测验`
- `复盘`

风格入口次级展示：

- `直接`
- `温和`
- `启发`

### 8.4 Notes 页

笔记页推荐切换的是：

- `整理`
- `精炼`
- `沉淀`
- `改写`

不建议在笔记页突出“角色扮演式人设”。

## 9. 与现有代码的映射建议

### 9.1 保留的部分

- [lib/ai/core/capability-profiles.ts](/Users/findbiao/projects/nexusnote/lib/ai/core/capability-profiles.ts)
- [stores/user-preferences.ts](/Users/findbiao/projects/nexusnote/stores/user-preferences.ts)
- [app/api/user/preferences/route.ts](/Users/findbiao/projects/nexusnote/app/api/user/preferences/route.ts)
- [app/api/user/persona/route.ts](/Users/findbiao/projects/nexusnote/app/api/user/persona/route.ts)

### 9.2 需要重构的部分

#### 现有 built-in personas

[lib/ai/personas/built-in.ts](/Users/findbiao/projects/nexusnote/lib/ai/personas/built-in.ts)

建议拆成：

- `core presets`
- `style skins`
- `experimental skins`

#### personalization

[lib/ai/personalization.ts](/Users/findbiao/projects/nexusnote/lib/ai/personalization.ts)

建议重构成：

- `buildUserPreferencePolicy`
- `buildSessionOverridePolicy`
- `compileAssistantPolicy`

#### prompt 拼装

[lib/ai/prompts/chat.ts](/Users/findbiao/projects/nexusnote/lib/ai/prompts/chat.ts)

建议不再直接使用：

`basePrompt + behaviorPrompt + skinPrompt + userContext`

而改成：

`basePrompt + compiledBehaviorPolicy + compiledContextPolicy + compiledPresentationPolicy`

## 10. 推荐内置配置

### 10.1 核心预设

- `standard`
- `teacher`
- `coach`
- `socratic`

### 10.2 学习场景模式

- `learn_explain`
- `learn_quiz`
- `learn_recap`
- `learn_debug`

### 10.3 笔记场景模式

- `note_structure`
- `note_polish`
- `note_distill`
- `note_review`

### 10.4 实验性皮肤

这些允许存在，但默认收纳：

- `girlfriend`
- `best_friend`
- `gordon`
- `clickbait`

它们只能影响表达层。

## 11. 观测和评估

### 11.1 运行时观测

每次响应记录：

- 当前 surface
- capability mode
- preset
- skin
- 是否用户手动切换
- 首 token 时延
- 完成时延
- 用户是否很快切回默认

### 11.2 回归评估

角色系统上线后必须新增这些 eval：

- 同一问题在不同 skin 下事实性不漂移
- 同一学习问题在 teacher / coach / socratic 下都不脱离课程上下文
- experimental skin 不得覆盖安全规则
- user preference 只改变表达，不改变工具边界

## 12. 分阶段落地

### Phase 1

目标：先把概念分层。

- Profile 新增 `AI 偏好`
- 现有 persona 重新标注为 `skin`
- chat / learn / notes 增加 `mode` 概念

### Phase 2

目标：改运行时编译链。

- 新增结构化 user preference policy
- 新增 session override policy
- 编译 effective assistant policy

### Phase 3

目标：补观测与 eval。

- metadata 带上 preset / skin / mode
- trace 带上 policy version
- eval 分 preset / mode 跑

### Phase 4

目标：收口旧 persona 架构。

- 降级 `systemPrompt` 直写模式
- 逐步迁移到结构化 preset

## 13. 最终建议

对 NexusNote：

- `AI 默认设置` 放个人页，正确
- `当前任务切换` 不能只放个人页，必须任务内可改
- `角色皮肤` 可以保留，但必须降为低优先级表达层
- 真正的一等概念应是 `mode + preference + context + skin`

一句话总结：

`NexusNote 应该做“可控的学习型 AI 行为系统”，而不是“可切换的角色扮演助手列表”。`

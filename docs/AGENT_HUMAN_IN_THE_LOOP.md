# Agent 人机交互循环（Human-in-the-Loop）

## 问题

之前的 Agent 实现是**假装交互**：
- Agent 制定计划时说"首先需要澄清用户需求"
- 但实际上它自己假设了用户的需求
- 然后继续执行，没有真正等待用户输入

**示例**：
```
用户: "帮我准备笔试"
Agent 计划:
  Step 1: 用户提到"笔试"，但目标描述不完整。首先需要澄清...
  Step 2: 根据用户澄清后的目标，制定具体计划...
  Step 3: 如果用户需要工具支持...

执行结果: "已确认用户需求为准备笔试，并制定了相应的复习计划建议。"
```

**问题**：Agent 根本没有在 Step 1 暂停等待用户澄清！

---

## 解决方案

### 1. 新增 `ask_user` 步骤类型

```typescript
export type StepType = 
  | 'observe'   // 观察
  | 'plan'      // 规划
  | 'execute'   // 执行工具
  | 'reflect'   // 反思
  | 'ask_user'  // 向用户提问 ← 新增

export type StepStatus = 
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'waiting_user'  // 等待用户输入 ← 新增
```

### 2. 步骤结构支持问答

```typescript
export interface AgentStep {
  id: string
  type: StepType
  status: StepStatus
  
  // 工具调用
  tool?: string
  input?: Record<string, unknown>
  output?: unknown
  
  // 人机交互
  question?: string       // 需要用户回答的问题
  userResponse?: string   // 用户的回答
  
  // 其他
  thought?: string
  error?: string
  startedAt?: number
  completedAt?: number
}
```

### 3. 执行逻辑支持暂停

```typescript
protected async executeStep(step: AgentStep): Promise<void> {
  // 特殊处理：需要用户输入的步骤
  if (step.type === 'ask_user') {
    step.status = 'waiting_user'
    this.state.status = 'paused'
    
    // 发出暂停事件，UI 显示问题
    this.emit({ 
      type: 'paused', 
      agentId: this.state.id, 
      reason: step.question || '需要用户输入'
    })
    
    // 等待用户输入（通过 resume() 方法提供）
    await this.waitForResume()
    
    // 用户输入后继续
    step.output = { userResponse: step.userResponse }
    step.status = 'completed'
    this.state.status = 'executing'
  }
  // ... 其他步骤类型
}
```

### 4. 恢复执行时提供用户输入

```typescript
/**
 * 恢复执行（提供用户输入）
 */
resume(userInput?: string): void {
  if (this.state.status === 'paused') {
    // 找到等待用户输入的步骤
    const waitingStep = this.state.plan?.steps.find(
      s => s.status === 'waiting_user'
    )
    
    if (waitingStep && userInput) {
      waitingStep.userResponse = userInput
    }
    
    this.state.status = 'executing'
    this.emit({ type: 'resumed', agentId: this.state.id })
  }
}
```

---

## 使用示例

### Agent 制定计划

```json
{
  "steps": [
    {
      "type": "ask_user",
      "thought": "用户提到'笔试'但没有说明具体科目和时间",
      "question": "请问你要准备什么科目的笔试？大概什么时候考试？"
    },
    {
      "type": "execute",
      "thought": "根据用户回答制定学习计划",
      "tool": "createLearningPlan",
      "input": { "goal": "准备{用户回答的科目}笔试" }
    }
  ]
}
```

### 前端处理

```typescript
const agent = new KnowledgeAgent()

// 监听暂停事件
agent.on((event) => {
  if (event.type === 'paused') {
    // 显示问题，等待用户输入
    const question = getCurrentStep()?.question
    showUserInputDialog(question)
  }
})

// 启动 Agent
const promise = agent.run({ goal: '帮我准备笔试' })

// 用户输入后恢复
function handleUserInput(input: string) {
  agent.resume(input)  // 提供用户输入并恢复执行
}

// 等待最终结果
const result = await promise
```

---

## 执行流程对比

### 修复前（假装交互）❌

```
用户: "帮我准备笔试"
  ↓
Agent 制定计划:
  1. 需要澄清用户需求
  2. 根据澄清后的目标制定计划
  3. 执行计划
  ↓
Agent 自己假设用户需求
  ↓
直接执行完所有步骤
  ↓
返回结果: "已确认用户需求为准备笔试..."
```

### 修复后（真正交互）✅

```
用户: "帮我准备笔试"
  ↓
Agent 制定计划:
  1. [ask_user] 请问你要准备什么科目的笔试？
  2. [execute] 根据用户回答制定学习计划
  ↓
执行 Step 1:
  - 状态变为 'paused'
  - 显示问题: "请问你要准备什么科目的笔试？"
  - 等待用户输入...
  ↓
用户输入: "计算机网络，下个月考试"
  ↓
Agent 恢复执行:
  - 记录用户回答
  - 状态变为 'executing'
  - 继续执行 Step 2
  ↓
执行 Step 2:
  - 调用 createLearningPlan
  - 参数: { goal: "准备计算机网络笔试，下个月考试" }
  ↓
返回结果: "已为你制定计算机网络笔试的学习计划..."
```

---

## Prompt 改进

### 修复前

```
规则:
1. 分析用户目标，制定清晰的执行计划
2. 每个步骤应该明确、可执行
3. 优先使用已有工具，避免不必要的步骤
```

**问题**：没有告诉 AI 可以向用户提问

### 修复后

```
步骤类型:
1. **ask_user** - 向用户提问以澄清需求（当用户目标不明确时使用）
2. **execute** - 执行工具调用
3. **plan** - 纯思考步骤

规则:
1. 如果用户目标不明确或缺少关键信息，**必须先使用 ask_user 步骤**
2. 每个步骤应该明确、可执行
3. 优先使用已有工具，避免不必要的步骤

示例计划:
{
  "steps": [
    {
      "type": "ask_user",
      "thought": "用户提到'笔试'但没有说明具体科目和时间",
      "question": "请问你要准备什么科目的笔试？大概什么时候考试？"
    },
    {
      "type": "execute",
      "thought": "根据用户回答制定学习计划",
      "tool": "createLearningPlan",
      "input": { "goal": "准备XX笔试" }
    }
  ]
}
```

---

## UI 改进建议

### 1. 显示等待状态

```tsx
{agent.status === 'paused' && currentStep?.type === 'ask_user' && (
  <div className="agent-question">
    <div className="question-icon">❓</div>
    <div className="question-text">{currentStep.question}</div>
    <input 
      type="text" 
      placeholder="请输入你的回答..."
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          handleUserInput(e.currentTarget.value)
        }
      }}
    />
  </div>
)}
```

### 2. 显示对话历史

```tsx
{agent.history.map(step => (
  step.type === 'ask_user' && (
    <div key={step.id} className="qa-pair">
      <div className="agent-question">
        🤖 {step.question}
      </div>
      <div className="user-answer">
        👤 {step.userResponse}
      </div>
    </div>
  )
))}
```

### 3. 进度指示

```tsx
<div className="agent-progress">
  {plan.steps.map((step, i) => (
    <div key={step.id} className={`step ${step.status}`}>
      {step.type === 'ask_user' && '❓'}
      {step.type === 'execute' && '⚙️'}
      {step.type === 'plan' && '💭'}
      {step.thought}
    </div>
  ))}
</div>
```

---

## 测试用例

### 测试 1：目标不明确

```typescript
test('should pause and ask user when goal is unclear', async () => {
  const agent = new KnowledgeAgent()
  
  let pausedEvent: any = null
  agent.on((event) => {
    if (event.type === 'paused') {
      pausedEvent = event
    }
  })
  
  const promise = agent.run({ goal: '帮我准备笔试' })
  
  // 等待暂停
  await waitFor(() => pausedEvent !== null)
  
  expect(agent.getState().status).toBe('paused')
  expect(pausedEvent.reason).toContain('请问')
  
  // 提供用户输入
  agent.resume('计算机网络，下个月考试')
  
  // 等待完成
  const result = await promise
  expect(result.success).toBe(true)
})
```

### 测试 2：目标明确

```typescript
test('should not pause when goal is clear', async () => {
  const agent = new KnowledgeAgent()
  
  let pausedEvent: any = null
  agent.on((event) => {
    if (event.type === 'paused') {
      pausedEvent = event
    }
  })
  
  const result = await agent.run({ 
    goal: '帮我制定计算机网络笔试的学习计划，下个月考试' 
  })
  
  expect(pausedEvent).toBeNull()  // 不应该暂停
  expect(result.success).toBe(true)
})
```

---

## 对比其他 Agent 框架

| 框架 | 人机交互 | 实现方式 |
|------|---------|---------|
| **LangChain** | ✅ | `HumanInputTool` |
| **AutoGPT** | ✅ | 每步都需要用户确认 |
| **BabyAGI** | ❌ | 完全自动化 |
| **你的实现** | ✅ | `ask_user` 步骤类型 |

---

## 未来改进

### 1. 多轮对话

```typescript
{
  "type": "ask_user",
  "question": "请问你要准备什么科目的笔试？",
  "followUp": [
    {
      "condition": "用户回答了科目",
      "question": "大概什么时候考试？"
    },
    {
      "condition": "用户回答了时间",
      "question": "你目前的基础如何？"
    }
  ]
}
```

### 2. 选项式问答

```typescript
{
  "type": "ask_user",
  "question": "请选择你的学习目标",
  "options": [
    "准备考试",
    "系统学习",
    "快速入门",
    "深入研究"
  ]
}
```

### 3. 表单式输入

```typescript
{
  "type": "ask_user",
  "question": "请填写学习计划信息",
  "form": {
    "subject": { type: "text", label: "科目" },
    "date": { type: "date", label: "考试日期" },
    "level": { type: "select", label: "基础", options: ["零基础", "有基础", "熟练"] }
  }
}
```

---

## 总结

### 修复前的问题
- ❌ Agent 假装交互，实际上自己假设用户需求
- ❌ 无法处理模糊的用户输入
- ❌ 用户体验差，感觉 Agent 不智能

### 修复后的优势
- ✅ 真正的人机交互循环
- ✅ 可以澄清模糊的需求
- ✅ 用户体验好，感觉 Agent 在认真理解需求
- ✅ 符合 Human-in-the-Loop 的最佳实践

### 技术亮点
- ✅ 类型安全的步骤定义
- ✅ 事件驱动的状态管理
- ✅ 可扩展的步骤类型系统
- ✅ 清晰的暂停/恢复机制

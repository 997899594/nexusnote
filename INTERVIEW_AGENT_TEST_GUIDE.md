# Interview Agent 测试指南

**日期**: 2026-02-03
**目的**: 验证 AI-Driven Interview Agent 的完整流程

---

## 🎯 测试目标

1. ✅ AI 对话是否自然（不生硬按顺序问）
2. ✅ Tool Calls 是否正确触发
3. ✅ 状态转换是否符合预期
4. ✅ 最终能否生成课程大纲

---

## 🚀 启动开发服务器

```bash
# 1. 确保环境变量配置正确
cat .env

# 需要的环境变量：
# - DATABASE_URL
# - AI 模型配置（302.ai 或 DeepSeek）
# - NEXTAUTH_SECRET

# 2. 启动开发服务器
pnpm dev

# 3. 打开浏览器
# http://localhost:3000
```

---

## 📝 测试场景

### 场景 1: 用户直接说目标（最常见）

**用户输入**:
```
我想学 Python
```

**预期 AI 行为**:
1. ✅ AI 应该理解目标是 "Python"
2. ✅ 调用 `updateProfile` 工具记录 `goal: "Python"`
3. ✅ 自然地询问用户背景（不是生硬地说"请告诉我你的背景"）

**示例理想回复**:
```
太好了！Python 是一门很棒的编程语言。请问你之前有编程经验吗？比如学过其他语言，还是完全零基础？
```

**检查点**:
- [ ] AI 是否调用了 `updateProfile` 工具？（打开浏览器 DevTools → Network → 查看响应）
- [ ] 前端 `useCourseGeneration` 的 `config.goal` 是否更新为 "Python"？
- [ ] 对话是否自然？

---

### 场景 2: 用户回答背景

**用户输入**:
```
零基础，之前没学过编程
```

**预期 AI 行为**:
1. ✅ 调用 `updateProfile` 工具记录 `background: "零基础"`
2. ✅ 继续询问时间安排

**示例理想回复**:
```
明白了！我们会从零开始。那你每周大概能投入多少时间学习呢？
```

**检查点**:
- [ ] 是否调用了 `updateProfile` 工具？
- [ ] `config.background` 是否更新？
- [ ] AI 是否自然地过渡到下一个问题？

---

### 场景 3: 用户回答时间

**用户输入**:
```
每周大概 10 小时
```

**预期 AI 行为**:
1. ✅ 调用 `updateProfile` 工具记录 `time: "每周 10 小时"`
2. ✅ 检测到所有信息已收集（goal, background, time）
3. ✅ 调用 `generateOutline` 工具生成课程大纲

**示例理想回复**:
```
很好！每周 10 小时的投入很充足。让我为你设计一个零基础的 Python 学习课程...

（然后调用 generateOutline 工具）
```

**检查点**:
- [ ] 是否调用了 `updateProfile` 工具？
- [ ] 是否调用了 `generateOutline` 工具？
- [ ] 前端是否收到完整的课程大纲？
- [ ] 页面是否跳转到 "outline_review" 阶段？

---

### 场景 4: AI 灵活性测试（高级）

**用户输入**:
```
我想学 Python，之前学过 JavaScript，每天能学 2 小时
```

**预期 AI 行为**:
1. ✅ **一次性**从输入中提取所有信息
2. ✅ 调用 `updateProfile` 包含所有字段：
   ```json
   {
     "goal": "Python",
     "background": "有 JavaScript 经验",
     "time": "每天 2 小时"
   }
   ```
3. ✅ 直接调用 `generateOutline` 生成课程（不再逐个询问）

**示例理想回复**:
```
太好了！既然你有 JavaScript 基础，我们可以快速进入 Python 的高级特性。让我为你设计一个进阶课程...
```

**检查点**:
- [ ] AI 是否足够聪明，能一次性理解所有信息？
- [ ] 是否跳过了逐个询问的步骤？
- [ ] 这证明了 AI-Driven 比 FSM 更灵活！

---

## 🔧 调试工具

### 1. 浏览器 DevTools (Network Tab)

**查看 API 请求**:
```
Filter: /api/learn/interview
```

**查看响应中的 Tool Calls**:
- 找到 `9:` 开头的行（Tool Call 事件）
- 解析 JSON，查看 `toolName` 和 `args`

**示例 Tool Call**:
```json
{
  "toolCallId": "call_abc123",
  "toolName": "updateProfile",
  "args": {
    "goal": "Python",
    "background": "零基础"
  }
}
```

---

### 2. 前端 Console

**检查 State**:
```javascript
// 在浏览器 Console 中运行
// (需要在 useCourseGeneration 中添加 window 调试)
console.log('Current Config:', state.config);
console.log('Current Outline:', state.outline);
```

---

### 3. Langfuse Dashboard（如果配置了）

**访问**: https://cloud.langfuse.com

**查看内容**:
1. ✅ 完整的对话历史
2. ✅ AI 的 Prompt（包括已收集信息）
3. ✅ Tool Calls 的执行记录
4. ✅ Token 消耗和成本

---

## 📊 测试结果记录

### ✅ 通过标准

- [ ] AI 能理解用户的学习目标
- [ ] Tool Calls 正确触发
- [ ] 对话自然流畅
- [ ] 能够灵活处理"一次性给全所有信息"的场景
- [ ] 最终生成有效的课程大纲

### ⚠️ 可能的问题

**问题 1: AI 还是按顺序问**
- **症状**: AI 说"请告诉我你的目标"（即使用户已经说了）
- **原因**: Prompt 不够强调"从输入中提取信息"
- **解决**: 调整 `buildPrompt` 中的指令

**问题 2: Tool Calls 不触发**
- **症状**: AI 只是文本回复，没有调用工具
- **原因**: Prompt 没有明确告诉 AI 何时调用工具
- **解决**: 在 Prompt 中加强"立即调用 updateProfile"的指令

**问题 3: 前端没有收到 Tool Calls**
- **症状**: Network 中看到了 Tool Call，但 `onToolCall` 没执行
- **原因**: AI SDK v6 的 Tool Call 解析可能有问题
- **解决**: 检查 `toolCall.type` 的格式是否正确

---

## 🎯 下一步（基于测试结果）

### 如果测试通过 ✅
1. 测试 RAG 检索质量（P1 任务）
2. 查看 Langfuse Dashboard
3. 优化 Prompt 模板化

### 如果测试失败 ❌
1. 根据问题调整 Prompt
2. 检查 Tool Call 的解析逻辑
3. 重新测试

---

## 📝 快速测试命令（可选）

如果想要自动化测试，可以运行：

```bash
# 创建测试脚本（手动测试更准确）
cd apps/web
npx tsx scripts/test-interview.ts
```

**注意**: 上面的脚本是辅助工具，**真实的用户体验测试必须在浏览器中完成**。

---

**测试负责人**: 你
**预期测试时间**: 15 分钟
**目标**: 找出 AI 对话的问题，优化 Prompt

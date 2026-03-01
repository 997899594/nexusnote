# Interview System Simplification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Simplify the interview system by removing the `suggestOptions` client tool and keeping only server-side tools. Options become pure UI shortcuts.

**Architecture:** AI generates text + tool calls. Server tools (`createCourseProfile`, `updateProfile`, `proposeOutline`) handle data persistence. Frontend option buttons are just text shortcuts - they send messages, not tool outputs.

**Tech Stack:** AI SDK v6, ToolLoopAgent, React, Zustand, Drizzle ORM

---

## Task 1: Remove `suggestOptions` Tool

**Files:**
- Modify: `lib/ai/tools/interview/index.ts:142-162`

**Step 1: Delete the suggestOptions tool definition**

Remove lines 142-162 (the entire `SuggestOptionsSchema` and `suggestOptionsTool` definition).

The file should now have:
1. `assessComplexityTool` (lines 23-57)
2. `updateProfileTool` (lines 62-139)
3. `proposeOutlineTool` (lines 167-190) - keep as client tool (no execute)
4. `createCourseProfileTool` (lines 194-241)
5. `confirmOutlineTool` (lines 246-284)
6. `interviewTools` export (lines 290-297)

**Step 2: Remove from interviewTools export object**

In the `interviewTools` export, remove the `suggestOptions` line:

```typescript
export const interviewTools = {
  assessComplexity: assessComplexityTool,
  updateProfile: updateProfileTool,
  // REMOVE: suggestOptions: suggestOptionsTool,
  proposeOutline: proposeOutlineTool,
  createCourseProfile: createCourseProfileTool,
  confirmOutline: confirmOutlineTool,
};
```

**Step 3: Commit**

```bash
git add lib/ai/tools/interview/index.ts
git commit -m "refactor(interview): remove suggestOptions tool"
```

---

## Task 2: Update Agent Interview Instructions

**Files:**
- Modify: `lib/ai/agents/index.ts:58-88`

**Step 1: Simplify interview instructions**

Replace the current `interview` instructions (lines 58-88) with:

```typescript
  interview: `你是 NexusNote 的课程规划师。

## 核心任务
通过自然对话了解用户的学习需求，生成个性化课程大纲。

## 工作流程

1. **初始**：用户说想学 X
   - 调用 assessComplexity 评估复杂度
   - 调用 createCourseProfile 创建画像
   - 文字确认 + 提问

2. **每轮**：用户回答
   - 调用 updateProfile 更新信息
   - 文字回应 + 继续提问（如需）

3. **完成**：信息充足
   - 调用 proposeOutline 生成大纲
   - 文字总结

## 复杂度指南
- trivial: 直接生成大纲
- simple: 1轮确认
- moderate: 2-3轮
- complex: 4-5轮

## 行为准则
- 主动、简洁、自然
- 像朋友聊天，不审问
- 每次回复都要有文字`,
```

**Step 2: Commit**

```bash
git add lib/ai/agents/index.ts
git commit -m "refactor(agents): simplify interview instructions"
```

---

## Task 3: Remove suggestOptions from ToolResultRenderer

**Files:**
- Modify: `components/chat/tool-result/ToolResultRenderer.tsx:131-153`

**Step 1: Delete the suggestOptions case**

Remove lines 131-153 (the entire `case "suggestOptions"` block).

**Step 2: Remove unused import**

Remove the `InterviewOptions` import (line 11):

```typescript
// REMOVE: import { InterviewOptions } from "./InterviewOptions";
```

**Step 3: Commit**

```bash
git add components/chat/tool-result/ToolResultRenderer.tsx
git commit -m "refactor(ui): remove suggestOptions rendering"
```

---

## Task 4: Clean Up InterviewOptions Component (Keep or Delete)

**Decision:** Keep the `InterviewOptions` component for potential future use as UI-only option buttons, but it's no longer used in ToolResultRenderer.

**Files:**
- No changes required (component can stay for future use)

**Alternative:** If you want to delete it:

```bash
rm components/chat/tool-result/InterviewOptions.tsx
git add components/chat/tool-result/InterviewOptions.tsx
git commit -m "chore: remove unused InterviewOptions component"
```

---

## Task 5: Update Interview Page (Remove addToolOutput)

**Files:**
- Modify: `app/interview/page.tsx`

**Step 1: Remove addToolOutput prop usage**

The page passes `addToolOutput` to `ChatMessage` but it's no longer needed for suggestOptions. Keep the prop for potential future use (e.g., confirmOutline), but it's now optional.

No code changes needed - the current code already handles this correctly:
```typescript
<ChatMessage
  key={msg.id}
  message={msg}
  onSendReply={(text) => sendMessage({ text })}
  addToolOutput={addToolOutput}
/>
```

**Step 2: Verify typecheck**

```bash
bun run typecheck
```

Expected: No errors

**Step 3: Commit**

```bash
git add app/interview/page.tsx
git commit -m "docs: interview page no longer needs addToolOutput for options"
```

---

## Task 6: Update useInterview Hook (Cleanup)

**Files:**
- Modify: `hooks/useInterview.ts`

**Step 1: Keep addToolOutput in return type**

The hook already exposes `addToolOutput` for potential future client tools (like `confirmOutline`). No changes needed.

**Step 2: Verify the hook works**

```bash
bun run typecheck
```

Expected: No errors

---

## Task 7: Update Interview API Route

**Files:**
- Modify: `app/api/interview/route.ts`

**Step 1: Verify no changes needed**

The API route doesn't have any special handling for `suggestOptions`. It just passes messages to the agent. No changes needed.

**Step 2: Verify typecheck**

```bash
bun run typecheck
```

---

## Task 8: Verification

**Step 1: Run typecheck**

```bash
bun run typecheck
```

Expected: No errors

**Step 2: Run linter**

```bash
bun run lint
```

Expected: No errors (or auto-fix with `bun run lint --write`)

**Step 3: Test interview flow**

1. Start dev server: `bun dev`
2. Navigate to `http://localhost:3000/interview`
3. Send "我想学 Python"
4. Verify:
   - AI responds with text
   - AI calls `createCourseProfile` (visible in network tab)
   - No `suggestOptions` tool calls

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: interview simplification cleanup"
```

---

## Summary of Changes

| File | Change |
|------|--------|
| `lib/ai/tools/interview/index.ts` | Remove `suggestOptionsTool` and schema |
| `lib/ai/agents/index.ts` | Simplify interview instructions |
| `components/chat/tool-result/ToolResultRenderer.tsx` | Remove `suggestOptions` case |
| `components/chat/tool-result/InterviewOptions.tsx` | Keep (unused but potentially useful) |

## Files NOT Changed

| File | Reason |
|------|--------|
| `hooks/useInterview.ts` | Still needs `addToolOutput` for other tools |
| `app/api/interview/route.ts` | No special handling needed |
| `app/interview/page.tsx` | Already passes `addToolOutput` correctly |
| `stores/chat.ts` | No interview-specific state |
| `lib/ai/validation.ts` | No changes needed |

---

## Testing Checklist

- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes
- [ ] Interview page loads without errors
- [ ] AI responds with text when user sends message
- [ ] `createCourseProfile` is called on first message
- [ ] `updateProfile` is called after user responds
- [ ] `proposeOutline` is called when interview completes
- [ ] No `suggestOptions` tool calls in network tab

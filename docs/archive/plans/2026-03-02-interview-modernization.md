# Interview System Modernization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the interview system to eliminate lag by removing per-turn outline generation, only generating outlines at completion with animated panel reveal.

**Architecture:** AI speaks naturally every turn, calls `suggestOptions` for UI options (doesn't stop loop), calls `confirmOutline` only at end to trigger panel animation. Left panel slides in with spring animation only after interview completes.

**Tech Stack:** Next.js 16, AI SDK v6, Zustand, Framer Motion, Tiptap v3

---

## Task 1: Update Interview Agent Instructions

**Files:**
- Modify: `lib/ai/agents/index.ts:57-91`

**Step 1: Rewrite interview instructions**

Replace the current `INSTRUCTIONS.interview` with the updated version that removes `updateOutline` calls:

```typescript
interview: `你是 NexusNote 的课程规划师。

## 核心任务
通过自然对话了解用户的学习需求，每轮都生成完整课程大纲。

## 重要：课程 ID 已在上下文中
系统已经为你创建了课程（course），在对话上下文的 "=== Interview Context ===" 部分可以找到 Course Profile ID。
**不要调用 createCourseProfile，直接使用上下文中提供的 ID。**

## 工作流程

1. **首轮**：用户说想学 X
   - 从上下文获取 Course Profile ID
   - 调用 updateProfile 记录 goal
   - 调用 suggestOptions 提供选项
   - 文字确认 + 提问

2. **每轮**：用户回答
   - 调用 updateProfile 更新画像（background, currentLevel, targetOutcome 等）
   - 调用 suggestOptions 提供 3-4 个选项
   - 文字回应 + 继续提问

3. **完成**：用户满意（通常 3-5 轮后）
   - 调用 confirmOutline 生成最终大纲
   - 告知用户可以开始学习

## 行为准则
- 主动、简洁、自然
- 像朋友聊天，不审问
- 每次回复都要有文字
- 每轮都要调用 suggestOptions 提供选项
- **只在访谈结束时调用 confirmOutline**`,
```

**Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/ai/agents/index.ts
git commit -m "refactor(agent): remove updateOutline from interview flow, only call confirmOutline at end"
```

---

## Task 2: Update Interview Tools Export

**Files:**
- Modify: `lib/ai/tools/interview/index.ts:340-347`

**Step 1: Remove updateOutline from exported tools**

Change the interviewTools export to exclude `updateOutline`:

```typescript
export const interviewTools = {
  createCourseProfile: createCourseProfileTool,
  updateProfile: updateProfileTool,
  suggestOptions: suggestOptionsTool,
  confirmOutline: confirmOutlineTool,
};
```

**Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/ai/tools/interview/index.ts
git commit -m "refactor(tools): remove updateOutline from interview tools export"
```

---

## Task 3: Update InterviewOptions Component Colors

**Files:**
- Modify: `components/interview/InterviewOptions.tsx:59-66`

**Step 1: Change purple hover to zinc**

Replace the purple hover colors with zinc:

```typescript
className={cn(
  "inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5",
  "text-sm font-medium text-zinc-700 shadow-sm",
  "transition-colors duration-200",
  "hover:bg-zinc-900 hover:text-white hover:border-zinc-900",
  "focus:outline-none focus:ring-2 focus:ring-zinc-500/50 focus:ring-offset-2",
)}
```

**Step 2: Visual verification**

Run: `bun dev`
Visit: http://localhost:3000/interview
Click an example to start interview
Expected: Option buttons have black/white hover style

**Step 3: Commit**

```bash
git add components/interview/InterviewOptions.tsx
git commit -m "style(InterviewOptions): change purple to zinc for minimalist style"
```

---

## Task 4: Add Progress Indicator to Interview Page

**Files:**
- Modify: `app/interview/page.tsx`

**Step 1: Add interview progress indicator component**

Add after line 170 (inside header description):

```typescript
{/* Progress indicator */}
{!interviewCompleted && chatMessages.length > 0 && (
  <div className="flex items-center gap-2 mt-1">
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((step) => {
        const isCompleted = chatMessages.filter((m) => m.role === "user").length >= step;
        const isCurrent = chatMessages.filter((m) => m.role === "user").length === step - 1;
        return (
          <motion.div
            key={step}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: isCompleted ? 1 : isCurrent ? 1.1 : 0.9,
              opacity: isCompleted ? 1 : isCurrent ? 0.8 : 0.3
            }}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              isCompleted ? "bg-zinc-900" : isCurrent ? "bg-zinc-400" : "bg-zinc-200"
            )}
          />
        );
      })}
    </div>
    <span className="text-xs text-zinc-400">
      {Math.min(chatMessages.filter((m) => m.role === "user").length, 5)}/5 轮
    </span>
  </div>
)}
```

**Step 2: Verify typecheck and visual**

Run: `bun run typecheck`
Expected: No errors

Run: `bun dev`
Visit interview page, start conversation
Expected: Progress dots appear in header, animate as conversation progresses

**Step 3: Commit**

```bash
git add app/interview/page.tsx
git commit -m "feat(interview): add progress indicator to header"
```

---

## Task 5: Update API Route Interview Context

**Files:**
- Modify: `app/api/interview/route.ts:150-156`

**Step 1: Update interview context message**

Replace the context template:

```typescript
const interviewContext = `
=== Interview Context ===
User ID: ${userId}
Course ID: ${activeCourseId}

工作流程：
1. 每轮对话后调用 updateProfile 更新用户画像
2. 每轮对话后调用 suggestOptions 提供 3-4 个选项
3. 访谈结束时（用户满意）调用 confirmOutline 生成最终大纲
4. 不要每轮都调用 confirmOutline，只在访谈结束时调用
`;
```

**Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add app/api/interview/route.ts
git commit -m "refactor(api): update interview context with new workflow"
```

---

## Task 6: Update useInterview Hook for confirmOutline

**Files:**
- Modify: `hooks/useInterview.ts:90-110`

**Step 1: Update confirmOutline listener**

The current implementation should already work, but verify the tool part type check:

```typescript
// 监听 confirmOutline 工具调用 - 访谈完成
useEffect(() => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage || lastMessage.role !== "assistant") return;

  const toolParts = lastMessage.parts
    ?.filter(isToolPart)
    .filter((p) => p.type === "tool-confirmOutline" && p.state === "output-available");

  if (toolParts && toolParts.length > 0) {
    const lastToolPart = toolParts[toolParts.length - 1];
    const output = lastToolPart.output as { outline?: unknown; success?: boolean } | undefined;

    if (output?.success) {
      // 访谈完成，设置大纲和完成状态
      // confirmOutline 返回的 outline 可能在 outlineData 字段
      const outlineData = (output as { outlineData?: unknown }).outlineData || output?.outline;
      if (outlineData) {
        setOutline(outlineData as never);
      }
      setInterviewCompleted(true);
      setIsOutlineLoading(false);
    }
  }
}, [messages, setOutline, setInterviewCompleted, setIsOutlineLoading]);
```

**Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add hooks/useInterview.ts
git commit -m "fix(hook): improve confirmOutline detection in useInterview"
```

---

## Task 7: Update confirmOutline Tool Output Format

**Files:**
- Modify: `lib/ai/tools/interview/index.ts:302-334`

**Step 1: Update confirmOutline to return outline data**

Modify the return statement to include the full outline:

```typescript
export const confirmOutlineTool = tool({
  description: "用户确认大纲后，正式创建课程。保存大纲数据并准备生成章节内容。访谈结束时调用此工具。",
  inputSchema: ConfirmOutlineSchema,
  execute: async ({ courseProfileId, outline }) => {
    try {
      // 转换 modules 为 chapters 格式
      const chapters = outline.modules.map((module, index) => ({
        title: module.title,
        description: module.description,
        topics: module.chapters,
        order: index,
      }));

      const outlineData = {
        title: outline.title,
        description: outline.description,
        estimatedMinutes: outline.estimatedMinutes,
        chapters,
      };

      // 更新课程画像，保存大纲
      await db
        .update(courseSessions)
        .set({
          title: outline.title,
          description: outline.description,
          difficulty: outline.difficulty,
          estimatedMinutes: outline.estimatedMinutes,
          outlineData,
          interviewStatus: "completed",
          status: "outline_confirmed",
          updatedAt: new Date(),
        })
        .where(eq(courseSessions.id, courseProfileId));

      return {
        success: true,
        courseProfileId,
        title: outline.title,
        moduleCount: outline.modules.length,
        outline: outlineData, // 返回完整大纲数据
        message: "大纲已确认，准备生成课程内容",
      };
    } catch (error) {
      console.error("[Tool] confirmOutline error:", error);
      return { success: false, error: "确认大纲失败" };
    }
  },
});
```

**Step 2: Verify typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 3: Commit**

```bash
git add lib/ai/tools/interview/index.ts
git commit -m "fix(tool): confirmOutline returns full outline data for UI"
```

---

## Task 8: Final Verification and Build

**Files:**
- None (verification only)

**Step 1: Run typecheck**

Run: `bun run typecheck`
Expected: No errors

**Step 2: Run build**

Run: `SKIP_ENV_VALIDATION=true bun run build`
Expected: Build succeeds

**Step 3: Manual end-to-end test**

Run: `bun dev`
Visit: http://localhost:3000/interview

Test scenarios:
1. Start interview with "我想学炒西红柿"
2. Verify options appear as clickable buttons
3. Verify progress indicator updates
4. Continue conversation for 2-3 rounds
5. When AI calls confirmOutline, verify:
   - Left panel slides in with animation
   - Outline is displayed correctly
   - "开始学习" button works

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(interview): final adjustments for modernized interview system"
```

---

## Summary of Changes

| Component | Change |
|-----------|--------|
| `lib/ai/agents/index.ts` | Remove updateOutline from instructions, only use confirmOutline at end |
| `lib/ai/tools/interview/index.ts` | Remove updateOutline from export, enhance confirmOutline output |
| `app/api/interview/route.ts` | Update interview context with new workflow |
| `hooks/useInterview.ts` | Improve confirmOutline detection |
| `components/interview/InterviewOptions.tsx` | Change purple to zinc colors |
| `app/interview/page.tsx` | Add progress indicator |

## Expected Behavior After Changes

1. **During interview:**
   - AI speaks naturally, calls `updateProfile` and `suggestOptions`
   - Options appear as clickable buttons (zinc/black style)
   - Progress indicator shows current turn
   - No lag from outline generation

2. **When interview completes:**
   - AI calls `confirmOutline` once
   - Left panel slides in with spring animation
   - Outline displays with chapters
   - "开始学习" button available

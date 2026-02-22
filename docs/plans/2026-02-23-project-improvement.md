# 项目改进实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 清理空目录 + 修复所有 lint 警告

**Architecture:**
1. 删除遗留的空目录 (web/web, lib/)
2. 使用 Biome 自动修复大部分 lint 警告
3. 手动修复无法自动处理的问题

**Tech Stack:** Biome 2.4.4, Next.js 16, TypeScript 5.7

---

## Task 1: 清理空目录

**Files:**
- Delete: `web/web/`
- Delete: `lib/`

**Step 1: 确认空目录内容**

```bash
ls -laR web/web/
ls -laR lib/
```

Expected: 显示空目录或只有 `.git/` 跟踪

**Step 2: 删除空目录**

```bash
rm -rf web/web lib
```

**Step 3: 验证删除**

```bash
ls -la web/web 2>&1
ls -la lib 2>&1
```

Expected: "No such file or directory"

**Step 4: 提交**

```bash
git add -A
git commit -m "chore: remove empty directories (web/web, lib/)"
```

---

## Task 2: 自动修复 Lint 警告

**Files:**
- Modify: `components/chat/index.ts`
- Modify: `components/editor/index.ts`
- Modify: `components/auth/index.ts`
- Modify: 其他需要排序的文件

**Step 1: 运行自动修复**

```bash
cd web && biome check --write .
```

Expected: 输出显示修复了多个文件

**Step 2: 检查剩余警告**

```bash
biome check . --max-diagnostics=50
```

Expected: 只剩下无法自动修复的警告

**Step 3: 提交自动修复**

```bash
git add -A
git commit -m "fix: auto-fix lint warnings with biome"
```

---

## Task 3: 修复 Button Type 属性

**Files:**
- Modify: `components/editor/AIMenu.tsx`

**Step 1: 修复行 51 的 button**

```tsx
// 找到行 51 附近的 <button>
<button type="button" onClick={() => setIsOpen(!isOpen)}>
```

**Step 2: 修复行 91 的 button**

```tsx
// 找到行 91 附近的 <button>
<button type="button" key={action.id}
```

**Step 3: 修复行 134 的 button**

```tsx
// 找到行 134 附近的 <button>
<button type="button"
```

**Step 4: 验证修复**

```bash
biome check components/editor/AIMenu.tsx
```

Expected: 无 `useButtonType` 警告

**Step 5: 提交**

```bash
git add components/editor/AIMenu.tsx
git commit -m "fix: add type=\"button\" to button elements"
```

---

## Task 4: 修复 React Hook 依赖

**Files:**
- Modify: `components/chat/ChatPanel.tsx`

**Step 1: 读取文件定位问题**

```bash
grep -n "scrollToBottom" components/chat/ChatPanel.tsx
```

**Step 2: 用 useCallback 包装 scrollToBottom**

```tsx
// 在组件内找到 scrollToBottom 定义
const scrollToBottom = useCallback(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, []); // 添加空依赖数组
```

**Step 3: 验证修复**

```bash
biome check components/chat/ChatPanel.tsx
```

Expected: 无 `useExhaustiveDependencies` 警告

**Step 4: 提交**

```bash
git add components/chat/ChatPanel.tsx
git commit -m "fix: wrap scrollToBottom in useCallback"
```

---

## Task 5: 修复未使用的变量/参数

**Files:**
- Modify: `components/chat/CommandMenu.tsx`
- Modify: `components/chat/useChatSession.ts`
- Modify: `components/editor/AISuggestions.tsx`

**Step 1: 修复 CommandMenu.tsx (行 15)**

```tsx
// 删除未使用的 onClose 参数
export function CommandMenu({ commands, selectedIndex, onSelect }: CommandMenuProps) {
  // ...
}
```

**Step 2: 修复 useChatSession.ts (行 60)**

```tsx
// 删除未使用的 messages 解构
const { setMessages, sendMessage, status } = chat;
```

**Step 3: 修复 AISuggestions.tsx (行 213)**

```bash
# 查看具体未使用的变量
biome check components/editor/AISuggestions.tsx
```

根据输出删除或使用该变量

**Step 4: 验证修复**

```bash
biome check .
```

**Step 5: 提交**

```bash
git add components/chat/CommandMenu.tsx components/chat/useChatSession.ts components/editor/AISuggestions.tsx
git commit -m "fix: remove unused variables and parameters"
```

---

## Task 6: 最终验证

**Step 1: 运行完整 lint 检查**

```bash
biome check .
```

Expected: "Checked 99 files. No fixes applied."

**Step 2: 运行类型检查**

```bash
pnpm typecheck
```

Expected: 无错误

**Step 3: 运行构建测试**

```bash
pnpm build
```

Expected: 构建成功

**Step 4: 查看改进摘要**

```bash
git log --oneline -6
```

Expected: 看到 5-6 个改进相关的提交

**Step 5: 最终提交（如有调整）**

```bash
git add -A
git commit -m "chore: complete project cleanup and lint fixes"
```

---

## 验收标准

- ✅ `biome check .` - 0 errors, 0 warnings
- ✅ `pnpm typecheck` - 通过
- ✅ `pnpm build` - 成功
- ✅ 空目录已删除
- ✅ 所有改进已提交

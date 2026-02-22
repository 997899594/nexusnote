# 项目改进设计

**日期**: 2026-02-23
**目标**: 清理空目录 + 修复所有 lint 警告

---

## 概述

基于项目分析报告，执行以下改进：
1. 删除 4 个空目录
2. 修复 36 个 Biome lint 警告

---

## 步骤 1: 清理空目录

### 目标目录

| 路径 | 说明 |
|------|------|
| `web/web/` | 遗留的嵌套目录 |
| `lib/ai/` | 空目录（ai 已移至 web/lib/ai/） |
| `lib/fsrs/` | 空目录（fsrs 已合并至 web/lib/algorithm.ts） |
| `lib/ui/components/` | 空目录 |

### 命令

```bash
rm -rf web/web lib
```

---

## 步骤 2: 自动修复 Lint 警告

### 可自动修复的问题

| 类型 | 数量 | 说明 |
|------|------|------|
| `organizeImports` | 多个 | 导入/导出排序 |
| `noUnusedVariables` | 部分 | 未使用的变量 |
| `noUnusedFunctionParameters` | 部分 | 未使用的参数 |

### 命令

```bash
cd web && biome check --write .
```

---

## 步骤 3: 手动修复剩余问题

### 3.1 Button Type 属性

**文件**: `components/editor/AIMenu.tsx`

需要为所有 `<button>` 添加 `type="button"`：

```tsx
// 行 51
<button type="button" onClick={() => setIsOpen(!isOpen)}>

// 行 91
<button type="button" key={action.id} ...>

// 行 134
<button type="button" ...>
```

### 3.2 React Hook 依赖优化

**文件**: `components/chat/ChatPanel.tsx:118`

```tsx
// 修复前
useEffect(() => {
  scrollToBottom();
}, [scrollToBottom]);  // ❌ scrollToBottom 每次渲染都变化

// 修复后 - 在定义处用 useCallback 包装
const scrollToBottom = useCallback(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, []);  // ✅ 空依赖数组
```

---

## 步骤 4: 验证

### 检查命令

```bash
# Lint 检查
biome check .

# 类型检查
pnpm typecheck

# 确认空目录已删除
ls -la web/web lib  # 应该报错：No such file or directory
```

### 预期结果

- ✅ `biome check .` - 0 errors, 0 warnings
- ✅ `pnpm typecheck` - 通过
- ✅ 空目录已删除

---

## 执行顺序

1. 删除空目录
2. 运行自动修复
3. 手动修复剩余问题
4. 验证结果
5. 提交更改

---

## 预期影响

- 代码更整洁
- 无 lint 警告
- 项目结构更清晰
- 可维护性提升

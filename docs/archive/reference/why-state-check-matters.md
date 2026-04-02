# 为什么要检查 state？深入理解 AI SDK v6 工具调用机制

> 从"打补丁"到"架构正确"

## 🔴 问题：为什么 input 会是 undefined？

**错误信息：**
```
can't access property "options", input is undefined
```

## 🔍 根本原因：工具调用是状态机

### AI SDK v6 源码定义

```typescript
// node_modules/ai/dist/index.d.ts:1423-1472
type UIToolInvocation<TOOL> = {
  toolCallId: string;
  title?: string;
  providerExecuted?: boolean;
} & (
  | {
      state: 'input-streaming';
      input: DeepPartial<TOOL['input']> | undefined;  // ← 可能是 undefined
      output?: never;
    }
  | {
      state: 'input-available';
      input: TOOL['input'];  // ← 完整的 input
      output?: never;
    }
  | {
      state: 'output-available';
      input: TOOL['input'];  // ← 完整的 input
      output: TOOL['output'];  // ← 有 output
    }
  | {
      state: 'output-error';
      input: TOOL['input'];
      errorText: string;
    }
);
```

### 状态转换流程

```
AI 调用工具
    ↓
① input-streaming (流式传输中)
   - input 可能是 undefined
   - input 可能是 DeepPartial（部分数据）
    ↓
② input-available (输入完整)
   - input 完整可用
   - 等待执行
    ↓
③ output-available (执行完成)
   - input 完整
   - output 可用
```

## ❌ 错误做法：到处加可选链（打补丁）

```typescript
// ❌ 症状治疗：到处加 ?.
if (presentOptionsPart && isToolUIPart(presentOptionsPart) && presentOptionsPart.input) {
  const input = presentOptionsPart.input as { ... };
  if (Array.isArray(input?.options) && input.options.length > 0) {
    //                       ↑ 可选链
  }
}
```

**问题：**
1. 没有理解状态机本质
2. 可能在 `input-streaming` 阶段就读取数据（数据不完整）
3. 到处加 `?.` 污染代码
4. TypeScript 类型信息丢失

## ✅ 正确做法：检查 state（架构正确）

```typescript
// ✅ 根本解决：检查状态
if (presentOptionsPart && isToolUIPart(presentOptionsPart)) {
  // 只在 input 完整到达时才处理
  if (presentOptionsPart.state === 'input-available' ||
      presentOptionsPart.state === 'output-available') {

    // 此时 TypeScript 知道 input 一定存在且完整
    const input = presentOptionsPart.input as {
      options: string[];  // 不需要 optional
      targetField: string;
    };

    // 不需要可选链
    if (Array.isArray(input.options) && input.options.length > 0) {
      // ...
    }
  }
}
```

**优势：**
1. ✅ 理解状态机本质
2. ✅ 只处理完整数据
3. ✅ 代码清晰，无冗余保护
4. ✅ TypeScript 类型推导正确

## 📊 对比表

| 方面 | 打补丁（可选链） | 检查 state |
|------|-----------------|------------|
| **代码可读性** | ❌ 到处是 `?.` | ✅ 清晰明确 |
| **类型安全** | ⚠️ 丢失类型信息 | ✅ 完整类型推导 |
| **架构理解** | ❌ 不理解状态机 | ✅ 符合设计 |
| **处理时机** | ⚠️ 可能过早处理 | ✅ 等待完整数据 |
| **性能** | ⚠️ 多次检查 | ✅ 一次判断 |

## 🎯 实战场景

### 场景 1：显示工具选项

```typescript
// ❌ 打补丁版本
const presentOptionsPart = activeMessage.parts.find(
  part => isToolUIPart(part) && getToolName(part) === 'presentOptions'
);

if (presentOptionsPart && isToolUIPart(presentOptionsPart) && presentOptionsPart.input) {
  const input = presentOptionsPart.input as { options?: string[]; targetField?: string; };
  if (Array.isArray(input?.options) && input.options.length > 0) {
    // 5 层嵌套，3 个可选检查
  }
}

// ✅ 正确版本
const presentOptionsPart = activeMessage.parts.find(
  part => isToolUIPart(part) && getToolName(part) === 'presentOptions'
);

if (presentOptionsPart && isToolUIPart(presentOptionsPart) &&
    (presentOptionsPart.state === 'input-available' || presentOptionsPart.state === 'output-available')) {
  const input = presentOptionsPart.input as { options: string[]; targetField: string; };
  if (input.options.length > 0) {
    // 3 层嵌套，1 个状态检查，类型安全
  }
}
```

### 场景 2：检测 generateOutline

```typescript
// useCourseGeneration.ts
useEffect(() => {
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage?.parts) return;

  const generateOutlinePart = lastMessage.parts.find(
    p => isToolUIPart(p) && getToolName(p) === 'generateOutline'
  );

  if (!generateOutlinePart || !isToolUIPart(generateOutlinePart)) return;

  // ✅ 检查状态：只在输出可用时处理
  if (generateOutlinePart.state !== 'output-available') return;

  // 此时 input 和 output 都完整可用
  const outline = generateOutlinePart.input;

  if (outline.title && outline.modules) {
    dispatch({ type: 'SET_OUTLINE', payload: outline });
    dispatch({ type: 'TRANSITION', payload: 'outline_review' });
  }
}, [messages]);
```

## 🧠 为什么 TypeScript 不能自动推导？

```typescript
type ToolPart =
  | { state: 'input-streaming'; input: undefined }
  | { state: 'input-available'; input: { options: string[] } };

const part: ToolPart = getToolPart();

// ❌ TypeScript 不知道是哪个分支
console.log(part.input.options);  // 错误：可能是 undefined

// ✅ 检查 state 后，TypeScript 知道是哪个分支
if (part.state === 'input-available') {
  console.log(part.input.options);  // 正确：TypeScript 知道 input 存在
}
```

这叫 **discriminated union**（可辨识联合类型），`state` 是判别器。

## 📝 最佳实践总结

### 1. 处理工具调用时，先检查 state

```typescript
if (isToolUIPart(part)) {
  if (part.state === 'input-available' || part.state === 'output-available') {
    // 安全处理 part.input
  }
}
```

### 2. 不要过早处理流式数据

```typescript
// ❌ 错误：在 input-streaming 时就处理
if (isToolUIPart(part) && part.input) {
  // part.input 可能是部分数据
}

// ✅ 正确：等待完整数据
if (isToolUIPart(part) && part.state === 'input-available') {
  // part.input 一定是完整数据
}
```

### 3. 利用 TypeScript 的类型收窄

```typescript
// TypeScript 知道在这个分支里 input 的类型
if (part.state === 'input-available') {
  const input: CompleteInput = part.input;  // 不需要 optional
}
```

## 🎓 结论

**问题本质：** 不是"需要保护"，而是"需要理解状态机"。

**正确心态：**
- ❌ "input 可能是 undefined，我加个 `?.` 保护一下"
- ✅ "input 在某些状态下才完整，我应该检查 state"

**收益：**
- 代码更清晰
- 类型更安全
- 架构更正确
- 符合 AI SDK v6 设计

---

## 🔗 相关资料

- AI SDK v6 类型定义：`node_modules/ai/dist/index.d.ts:1423-1472`
- TypeScript Discriminated Unions：https://www.typescriptlang.org/docs/handbook/unions-and-intersections.html#discriminating-unions
- 项目代码：`components/create/ChatInterface.tsx`

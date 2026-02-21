import {
  getToolName,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type UIDataTypes,
  type UIMessage,
  type UIMessagePart,
  type UITools,
} from "ai";

/**
 * 2026 架构师标准：类型安全的 UI 消息修剪工具
 * 解决了 AI SDK v6 中 pruneMessages 仅支持 ModelMessage 的架构局限
 */
export interface PruneUIMessagesOptions {
  /**
   * 推理过程保留策略
   */
  reasoning?: "all" | "none" | "before-last-message";
  /**
   * 工具调用保留策略 (目前支持简单策略，后续可扩展)
   */
  toolCalls?: "all" | "none" | "before-last-3-messages";
  /**
   * 是否移除空消息
   */
  emptyMessages?: "keep" | "remove";
}

export function pruneUIMessages(
  messages: UIMessage[],
  options: PruneUIMessagesOptions = {},
): UIMessage[] {
  const { reasoning = "all", toolCalls = "all", emptyMessages = "remove" } = options;

  const result: UIMessage[] = [];

  for (let i = 0; i < messages.length; i++) {
    const isLast = i === messages.length - 1;
    const isWithinLast3 = i >= messages.length - 3;
    const message = messages[i];

    // 深拷贝 parts 避免修改原始对象
    let newParts = [...(message.parts || [])];

    // 1. 处理推理过程
    if (reasoning === "none") {
      newParts = newParts.filter((p) => !isReasoningUIPart(p));
    } else if (reasoning === "before-last-message" && !isLast) {
      newParts = newParts.filter((p) => !isReasoningUIPart(p));
    }

    // 2. 处理工具调用
    if (toolCalls === "none") {
      newParts = newParts.filter((p) => !isToolUIPart(p));
    } else if (toolCalls === "before-last-3-messages" && !isWithinLast3) {
      newParts = newParts.filter((p) => !isToolUIPart(p));
    }

    // 3. 检查空消息
    if (emptyMessages === "remove" && newParts.length === 0) {
      continue;
    }

    result.push({
      ...message,
      parts: newParts as UIMessagePart<UIDataTypes, UITools>[],
    });
  }

  return result;
}

/**
 * 2026 架构师标准：类型安全的工具提取
 * 使用更宽松的约束以适配 AI SDK v6 的 Tool vs UITool 类型差异
 */
export function getToolCalls(message: UIMessage) {
  if (!message.parts) return [];

  return message.parts.filter(isToolUIPart).map((part) => ({
    toolName: getToolName(part),
    toolCallId: part.toolCallId,
    state: part.state,
    input: part.input,
    args: part.input, // 别名，方便访问
    output: part.output,
    errorText: "errorText" in part ? (part.errorText as string) : undefined,
  }));
}

/**
 * 提取消息中的主要文本内容，支持 Schema-First 工具回复
 * 2026 修复：正确处理工具调用的 input-available 状态
 */
export function getMessageContent(message: UIMessage): string {
  if (!message.parts) return "";

  const textParts = message.parts
    .filter(isTextUIPart)
    .map((p) => p.text)
    .join("");

  if (textParts) return textParts;

  // Schema-First 回退：从工具输入的 replyToUser 提取
  // 修复：无论工具调用处于什么状态（input-available, input-streaming, output-available）都提取
  let content = "";
  for (const part of message.parts) {
    if (isToolUIPart(part)) {
      const input = part.input as Record<string, unknown>;
      if (typeof input?.replyToUser === "string") {
        content += (content ? "\n\n" : "") + input.replyToUser;
      }
    }
  }

  return content;
}

/**
 * 提取消息中的推理过程
 */
export function getReasoningContent(message: UIMessage): string {
  if (!message.parts) return "";
  return message.parts
    .filter(isReasoningUIPart)
    .map((p) => p.text)
    .join("\n");
}

/**
 * 查找特定的工具调用（真正的类型安全版）
 * 通过 NAME 约束，自动推导出 input 和 output 的类型
 * 2026 架构师方案：封装内部转换，对外暴露纯净接口
 */
export function findToolCall<TInput = unknown, TOutput = unknown>(
  message: UIMessage,
  toolName: string,
): {
  toolCallId: string;
  state:
    | "input-streaming"
    | "input-available"
    | "approval-requested"
    | "approval-responded"
    | "output-available"
    | "output-error"
    | "output-denied";
  input: TInput;
  output: TOutput;
  errorText?: string;
} | null {
  if (!message.parts) return null;

  for (const part of message.parts) {
    if (isToolUIPart(part) && getToolName(part) === toolName) {
      return {
        toolCallId: part.toolCallId,
        state: part.state,
        input: part.input as TInput,
        output: part.output as TOutput,
        errorText: "errorText" in part ? (part.errorText as string) : undefined,
      };
    }
  }

  return null;
}

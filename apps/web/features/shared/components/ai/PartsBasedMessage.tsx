"use client";

import { getToolName, isTextUIPart, isToolUIPart, type UIMessage } from "ai";
import { z } from "zod";

/**
 * presentOptions 工具的输入 Schema
 * 从工具定义中提取，用于类型安全的运行时验证
 */
const presentOptionsInputSchema = z.object({
  replyToUser: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  targetField: z.enum(["goal", "background", "targetOutcome", "cognitiveStyle", "general"]),
  allowSkip: z.boolean().optional(),
  multiSelect: z.boolean().optional(),
});
import { Bot } from "lucide-react";
import { type ReactNode } from "react";
import { MessageResponse } from "@/features/chat/components/ai/Message";
import { cn } from "@/features/shared/utils";

/**
 * Parts-Based Message Renderer
 *
 * 遵循 AI SDK v6 官方架构：基于 message.parts 数组顺序渲染
 *
 * 核心设计原则：
 * 1. 按 parts 自然顺序迭代，不合并
 * 2. 工具输出 (output-available) 作为视觉段落分割点
 * 3. 每个段落独立渲染，形成"多个对话气泡"效果
 *
 * 这样可以正确处理 AI 多轮交互场景：
 * - AI 问问题 → 工具调用 → 用户选择 → AI 继续回复 → 工具调用...
 * 所有内容在一个 message 对象中，但 UI 上呈现为多个独立气泡
 */

interface PartsBasedMessageProps {
  message: UIMessage;
  variant?: "chat" | "interview";
  isLastMessage?: boolean;
  renderToolOutput?: (toolName: string, output: unknown, toolCallId: string) => ReactNode;
  renderToolOptions?: (input: {
    options: string[];
    toolCallId: string;
    replyToUser?: string;
    targetField?: string;
  }) => ReactNode;
}

/**
 * 视觉段落类型
 *
 * 一个助手消息可能包含多个视觉段落：
 * - 段落 1: AI 初始文本 + 工具调用（等待用户）
 * - （用户通过工具输出响应）
 * - 段落 2: AI 继续回复 + 工具调用
 * - （用户响应）
 * - 段落 3: AI 再继续...
 */
interface VisualSegment {
  id: string;
  texts: string[];
  tools: Array<{
    toolCallId: string;
    toolName: string;
    state: string;
    input?: unknown;
  }>;
  hasOutputBefore: boolean; // 此段落前是否有用户响应（工具输出）
}

export function PartsBasedMessage({
  message,
  variant = "chat",
  isLastMessage = false,
  renderToolOutput,
  renderToolOptions,
}: PartsBasedMessageProps) {
  // 用户消息：简单处理
  if (message.role === "user") {
    const text = message.parts
      ?.filter(isTextUIPart)
      .map((p) => p.text)
      .join("") || "";

    return (
      <div className="flex justify-end w-full">
        <div
          className={cn(
            "max-w-[85%] text-left",
            variant === "interview"
              ? "bg-black px-6 py-3 rounded-[24px]"
              : "bg-primary px-6 py-3 rounded-[24px]",
          )}
        >
          <p
            className={cn(
              "text-sm md:text-base font-bold leading-relaxed",
              variant === "interview"
                ? "text-white text-right"
                : "text-primary-foreground",
            )}
          >
            {text}
          </p>
        </div>
      </div>
    );
  }

  // 助手消息：解析为视觉段落并渲染
  const segments = parseVisualSegments(message);

  if (segments.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {segments.map((segment, index) => (
        <AssistantSegmentBubble
          key={segment.id}
          segment={segment}
          variant={variant}
          isActive={isLastMessage && index === segments.length - 1}
          renderToolOutput={renderToolOutput}
          renderToolOptions={renderToolOptions}
        />
      ))}
    </div>
  );
}

/**
 * 解析助手消息为视觉段落
 *
 * 核心规则：工具输出 (output-available) 是段落分割点
 *
 * 示例 parts 序列：
 *   text "你想学什么？"
 *   tool presentOptions (input-available)
 *   tool presentOptions (output-available)  ← 分割点
 *   text "很好！Web开发是..."
 *   tool presentOptions (input-available)
 *
 * 结果：
 *   段落1: ["你想学什么？"] + [presentOptions工具]
 *   段落2: ["很好！Web开发是..."] + [presentOptions工具]
 */
function parseVisualSegments(message: UIMessage): VisualSegment[] {
  if (!message.parts) return [];

  const segments: VisualSegment[] = [];
  const currentSegment: Omit<VisualSegment, "id"> = {
    texts: [],
    tools: [],
    hasOutputBefore: false,
  };
  let segmentIndex = 0;

  for (const part of message.parts) {
    // 工具输出 = 分割点（用户已响应）
    if (isToolUIPart(part) && part.state === "output-available") {
      // 保存当前段落（如果有内容）
      if (
        currentSegment.texts.length > 0 ||
        currentSegment.tools.length > 0
      ) {
        segments.push({
          id: `seg-${segmentIndex++}`,
          ...currentSegment,
        });
      }
      // 开始新段落，标记已有用户响应
      currentSegment.texts = [];
      currentSegment.tools = [];
      currentSegment.hasOutputBefore = true;
      continue;
    }

    // 累积文本内容
    if (isTextUIPart(part) && part.text) {
      currentSegment.texts.push(part.text);
    }

    // 累积工具调用（仅 input-available，表示需要用户交互）
    if (isToolUIPart(part) && part.state === "input-available") {
      currentSegment.tools.push({
        toolCallId: part.toolCallId,
        toolName: getToolName(part),
        state: part.state,
        input: part.input,
      });
    }
  }

  // 保存最后一个段落
  if (
    currentSegment.texts.length > 0 ||
    currentSegment.tools.length > 0
  ) {
    segments.push({
      id: `seg-${segmentIndex}`,
      ...currentSegment,
    });
  }

  return segments;
}

/**
 * 助手消息段落气泡
 *
 * 每个段落独立渲染为一个气泡，视觉上形成多个对话回合
 */
interface AssistantSegmentBubbleProps {
  segment: VisualSegment;
  variant: "chat" | "interview";
  isActive: boolean;
  renderToolOutput?: (toolName: string, output: unknown, toolCallId: string) => ReactNode;
  renderToolOptions?: (input: {
    options: string[];
    toolCallId: string;
    replyToUser?: string;
    targetField?: string;
  }) => ReactNode;
}

function AssistantSegmentBubble({
  segment,
  variant,
  isActive,
  renderToolOutput,
  renderToolOptions,
}: AssistantSegmentBubbleProps) {
  const text = segment.texts.join("\n\n");

  // Interview 变体：简约白色气泡
  if (variant === "interview") {
    return (
      <div className="flex justify-start w-full">
        <div
          className={cn(
            "text-left",
            isActive
              ? "bg-white shadow-xl shadow-black/5 px-8 py-6 rounded-[32px] max-w-[95%] border border-black/[0.02]"
              : "bg-black/5 px-6 py-3 rounded-[24px] max-w-[85%]",
          )}
        >
          {/* 文本内容 */}
          {text && (
            <MessageResponse
              className={cn(
                "leading-snug",
                isActive
                  ? "text-lg md:text-xl font-bold tracking-tight text-black"
                  : "text-sm md:text-base font-medium text-black/60 leading-relaxed",
              )}
            >
              {text}
            </MessageResponse>
          )}

          {/* 工具选项按钮（presentOptions） */}
          {segment.tools.map((tool) => {
            if (tool.toolName === "presentOptions" && renderToolOptions) {
              // 使用 Zod schema 进行类型安全的运行时验证，而不是类型断言
              const inputResult = presentOptionsInputSchema.safeParse(tool.input);
              const input = inputResult.success ? inputResult.data : {
                options: [],
                replyToUser: "",
                targetField: "general",
              };
              return (
                <div key={tool.toolCallId} className="mt-4">
                  {renderToolOptions({
                    options: input.options || [],
                    toolCallId: tool.toolCallId,
                    replyToUser: input.replyToUser,
                    targetField: input.targetField,
                  })}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  // Chat 变体：带头像的完整样式
  return (
    <div className="flex gap-3 max-w-[95%] flex-row self-start">
      {/* AI 头像 */}
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
        <Bot className="w-4 h-4" />
      </div>

      {/* 消息内容 */}
      <div className="flex flex-col items-start min-w-0">
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-glass",
            isActive
              ? "bg-surface border-2 border-primary/20"
              : "bg-surface border border-border/50 rounded-tl-sm",
          )}
        >
          {/* 文本内容 */}
          {text ? (
            <MessageResponse>{text}</MessageResponse>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
            </div>
          )}

          {/* 工具选项按钮（presentOptions） */}
          {segment.tools.map((tool) => {
            if (tool.toolName === "presentOptions" && renderToolOptions) {
              const inputResult = presentOptionsInputSchema.safeParse(tool.input);
              const input = inputResult.success ? inputResult.data : {
                options: [],
                replyToUser: "",
                targetField: "general",
              };
              return (
                <div key={tool.toolCallId} className="mt-3">
                  {renderToolOptions({
                    options: input.options || [],
                    toolCallId: tool.toolCallId,
                    replyToUser: input.replyToUser,
                    targetField: input.targetField,
                  })}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}

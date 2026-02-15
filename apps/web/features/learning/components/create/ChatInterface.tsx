"use client";

import type { UIMessage as Message } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Zap } from "lucide-react";
import { UnifiedChatUI, DefaultOptionButtons } from "@/features/chat/components/ai/UnifiedChatUI";
import type { InterviewContext } from "@/features/learning/agents/interview/agent";

interface ChatInterfaceProps {
  phase: string;
  messages: Message[];
  isAiThinking: boolean;
  userInput: string;
  setUserInput: (v: string) => void;
  onSendMessage: (e?: React.FormEvent, override?: string) => void;
  onOptionSelect: (toolCallId: string, selected: string, targetField: string) => void;
  goal: string;
  interviewContext?: InterviewContext;
  error?: string | null;
  onRetry?: () => void;
  compact?: boolean;
}

/**
 * ChatInterface v2 - Parts-Based Rendering
 *
 * 重构为使用 AI SDK v6 推荐的 parts-based 渲染架构
 * - 移除 renderMessage 自定义渲染
 * - 使用 renderToolOptions 回调在 PartsBasedMessage 中内嵌渲染选项按钮
 * - 选项按钮现在是消息的一部分，而不是固定在输入框上方
 */
export function ChatInterface({
  phase,
  messages,
  isAiThinking,
  userInput,
  setUserInput,
  onSendMessage,
  onOptionSelect,
  goal,
  interviewContext,
  error,
  onRetry,
  compact = false,
}: ChatInterfaceProps) {
  const handleSendWithFeedback = (
    e?: React.FormEvent,
    override?: string,
  ) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(50);
    }
    onSendMessage(e, override);
  };

  if (phase !== "interview" && phase !== "synthesis") {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "interview" && (
        <motion.div
          key="interview-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={
            compact
              ? "flex flex-col h-full"
              : "absolute inset-0 z-[150] flex flex-col items-center justify-center px-4 md:px-6"
          }
        >
          <div
            className={
              compact ? "flex flex-col h-full w-full" : "max-w-4xl w-full flex flex-col h-[85vh]"
            }
          >
            <UnifiedChatUI
              messages={messages}
              isLoading={isAiThinking}
              input={userInput || ""}
              onInputChange={setUserInput}
              onSubmit={(e) => handleSendWithFeedback(e)}
              variant="interview"
              placeholder="Type your answer..."
              renderToolOptions={(input) => (
                <DefaultOptionButtons
                  options={input.options}
                  toolCallId={input.toolCallId}
                  onSelect={(toolCallId, option) => {
                    // 从工具输入中获取 targetField
                    const targetField = input.targetField || "general";
                    onOptionSelect(toolCallId, option, targetField);
                  }}
                />
              )}
              renderEmpty={() => (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-black/40">
                  {isAiThinking ? (
                    <>
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <p className="text-sm font-medium">等待AI响应中... 目标: {goal}</p>
                      <p className="text-xs text-black/20">(自动启动中，请稍候...)</p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium">准备开始... 目标: {goal}</p>
                      <p className="text-xs text-black/20 mb-2">
                        (如果没有自动启动，请点击下方按钮)
                      </p>
                      <button
                        onClick={() =>
                          handleSendWithFeedback(undefined, `我的目标是：${goal}。请开始访谈。`)
                        }
                        className="mt-4 px-6 py-2 bg-black text-white rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/10"
                      >
                        手动开始
                      </button>
                    </>
                  )}
                </div>
              )}
              renderAfterMessages={() => (
                <>
                  {/* Waiting Indicator - AI 正在思考时显示 */}
                  {isAiThinking && messages.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start pt-4"
                    >
                      <div className="bg-white shadow-xl shadow-black/5 px-8 py-6 rounded-[32px] max-w-[95%] text-left border border-black/[0.02]">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-black/20 animate-pulse" />
                          <p className="text-black/20 font-bold uppercase text-[10px] tracking-[0.2em]">
                            WAITING FOR RESPONSE
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
              showReasoningSection={false}
            />
          </div>
        </motion.div>
      )}

      {phase === "synthesis" && !compact && (
        <motion.div
          key="synthesis"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[150] flex flex-col items-center justify-center px-6"
        >
          <div className="max-w-xl w-full space-y-12">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-[32px] bg-black flex items-center justify-center">
                  <Zap className="w-8 h-8 text-white animate-pulse" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.5], opacity: [0.3, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-[32px] border-2 border-black"
                />
              </div>
            </div>

            <div className="space-y-6 text-center">
              <h2 className="text-2xl font-bold tracking-tight text-black">
                正在合成你的定制学习路径...
              </h2>
              <div className="space-y-4 text-left bg-black/[0.02] p-8 rounded-[32px] border border-black/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-black" />
                  <p className="text-sm font-medium text-black/60">目标：{goal}</p>
                </div>

                {interviewContext?.targetOutcome && (
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    <p className="text-sm font-medium text-black/60">
                      预期成果：{interviewContext?.targetOutcome}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 text-black pt-4 border-t border-black/5">
                  <Check className="w-4 h-4" />
                  <p className="text-sm font-bold italic">"已为你优化知识关联，准备生成结构。"</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

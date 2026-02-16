"use client";

import type { UIMessage as Message } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  UnifiedChatUI,
  DefaultOptionButtons,
} from "@/features/chat/components/ai/UnifiedChatUI";
import type { InterviewPhase } from "@/features/learning/types";

interface ChatInterfaceProps {
  phase: InterviewPhase;
  messages: Message[];
  isAiThinking: boolean;
  userInput: string;
  setUserInput: (v: string) => void;
  onSendMessage: (e?: React.FormEvent, override?: string) => void;
  onOptionSelect: (toolCallId: string, selected: string) => void;
  goal: string;
  error?: string | null;
  compact?: boolean;
  // proposeOutline 相关
  proposedOutline?: { summary: string; suggestedTitle: string } | null;
  onConfirmOutline?: () => void;
  onAdjustOutline?: (feedback: string) => void;
}

export function ChatInterface({
  phase,
  messages,
  isAiThinking,
  userInput,
  setUserInput,
  onSendMessage,
  onOptionSelect,
  goal,
  error,
  compact = false,
  proposedOutline,
  onConfirmOutline,
  onAdjustOutline,
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

  // 只在 interviewing 和 proposing 阶段显示聊天
  if (phase !== "interviewing" && phase !== "proposing") {
    return null;
  }

  return (
    <AnimatePresence mode="wait">
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
            compact
              ? "flex flex-col h-full w-full"
              : "max-w-4xl w-full flex flex-col h-[85vh]"
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
                  onOptionSelect(toolCallId, option);
                }}
              />
            )}
            renderEmpty={() => (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-black/40">
                {isAiThinking ? (
                  <>
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm font-medium">
                      等待AI响应中... 目标: {goal}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">
                      准备开始... 目标: {goal}
                    </p>
                    <button
                      onClick={() =>
                        handleSendWithFeedback(
                          undefined,
                          `我的目标是：${goal}。请开始访谈。`,
                        )
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
                {/* proposeOutline 确认 UI */}
                {phase === "proposing" && proposedOutline && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-6 bg-white rounded-[32px] shadow-xl shadow-black/5 border border-black/[0.04] space-y-4"
                  >
                    <div className="space-y-2">
                      <p className="text-xs font-black text-black/30 uppercase tracking-[0.2em]">
                        建议课程
                      </p>
                      <h3 className="text-xl font-black text-black tracking-tight">
                        {proposedOutline.suggestedTitle}
                      </h3>
                      <p className="text-sm text-black/60 leading-relaxed">
                        {proposedOutline.summary}
                      </p>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button
                        onClick={onConfirmOutline}
                        className="flex-1 px-6 py-3 bg-black text-white rounded-2xl text-sm font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-black/10"
                      >
                        开始生成大纲
                      </button>
                      <button
                        onClick={() => {
                          const feedback = prompt("请输入调整意见：");
                          if (feedback && onAdjustOutline) {
                            onAdjustOutline(feedback);
                          }
                        }}
                        className="px-6 py-3 bg-black/5 text-black/60 rounded-2xl text-sm font-bold hover:bg-black/10 transition-all"
                      >
                        调整
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Thinking indicator */}
                {isAiThinking && messages.length > 0 && !proposedOutline && (
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
    </AnimatePresence>
  );
}

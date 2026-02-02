"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ArrowRight, Check, Zap } from "lucide-react";
import { useEffect, useRef } from "react";
import { UIMessage } from "ai";

interface ToolPart {
  type: string;
  toolCallId: string;
  input?: unknown;
}

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { type: "text"; text: string }).text)
    .join("");
}

function getToolParts(message: UIMessage): ToolPart[] {
  return message.parts
    .filter((p) => p.type.startsWith("tool-"))
    .map((p) => p as unknown as ToolPart);
}

interface ChatInterfaceProps {
  phase: string;
  messages: UIMessage[];
  isAiThinking: boolean;
  userInput: string;
  setUserInput: (v: string) => void;
  onSendMessage: (e?: React.FormEvent, override?: string) => void;
  goal: string;
  config: any;
  error?: string | null;
  onRetry?: () => void;
}

export function ChatInterface({
  phase,
  messages,
  isAiThinking,
  userInput,
  setUserInput,
  onSendMessage,
  goal,
  config,
  error,
  onRetry,
}: ChatInterfaceProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Split messages into history and active interaction
  // If the last message is from assistant, it's the "Active Interaction"
  // Everything else is history
  const lastMessage = messages[messages.length - 1];
  const isLastAssistant = lastMessage?.role === "assistant";

  const historyMessages = isLastAssistant ? messages.slice(0, -1) : messages;
  const activeMessage = isLastAssistant ? lastMessage : null;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isAiThinking]);

  if (phase !== "interview" && phase !== "synthesis") {
    return null;
  }

  // Extract tool options from the active message
  let activeToolOptions: {
    options?: string[];
    optionGroups?: Array<{ title: string; options: string[] }>;
  } | null = null;

  if (activeMessage) {
    const toolParts = getToolParts(activeMessage);
    const presentOptionsTool = toolParts.find(
      (p) => p.type === "tool-presentOptions",
    );
    if (presentOptionsTool && presentOptionsTool.input) {
      activeToolOptions = presentOptionsTool.input as any;
    }
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "interview" && (
        <motion.div
          key="interview-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-[150] flex flex-col items-center justify-center px-4 md:px-6"
        >
          <div className="max-w-4xl w-full flex flex-col h-[85vh]">
            {/* Chat History */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto space-y-6 mb-6 scroll-smooth py-6 pr-4 md:pr-6 custom-scrollbar"
            >
              {error ? (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-red-500">
                  <p>出错了: {error}</p>
                  <button
                    onClick={onRetry}
                    className="bg-black text-white px-4 py-2 rounded hover:bg-black/80 transition-colors"
                  >
                    重试
                  </button>
                </div>
              ) : messages.length === 0 ? (
                /* Empty State */
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
                          onSendMessage(
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
              ) : (
                /* Message Loop */
                <>
                  {historyMessages.map((m) => {
                    const text = getMessageText(m);
                    // Skip empty text messages if they only have tool calls (unless we want to show something)
                    if (!text && m.role === "assistant") return null;

                    const isUser = m.role === "user";

                    return (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {isUser ? (
                          /* User Message (Right, Black) */
                          <div className="flex justify-end">
                            <div className="bg-black px-6 py-3 rounded-[24px] max-w-[85%] text-right shadow-lg shadow-black/10">
                              <p className="text-sm md:text-base font-bold text-white leading-relaxed">
                                {text}
                              </p>
                            </div>
                          </div>
                        ) : (
                          /* Assistant History Message (Left, Gray) */
                          <div className="flex justify-start">
                            <div className="bg-black/5 px-6 py-3 rounded-[24px] max-w-[85%] text-left">
                              <p className="text-sm md:text-base font-medium text-black/60 leading-relaxed">
                                {text}
                              </p>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}

                  {/* Current Active Interaction (Latest Assistant Message) */}
                  <div className="pt-2">
                    <AnimatePresence mode="wait">
                      {activeMessage && (
                        <motion.div
                          key="active-ai-reply"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="flex justify-start"
                        >
                          <div className="bg-black/5 px-6 py-4 rounded-[32px] max-w-[90%] text-left border border-black/[0.03]">
                            <p className="text-lg md:text-xl font-bold tracking-tight text-black italic leading-snug">
                              {getMessageText(activeMessage)}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Waiting Indicator */}
                  {isAiThinking &&
                    messages.length > 0 &&
                    messages[messages.length - 1].role !== "assistant" && (
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
            </div>

            {/* Hybrid UI / Shortcuts (Generative UI) - Fixed at Bottom */}
            <AnimatePresence>
              {activeToolOptions && !isAiThinking && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-6 px-4 flex flex-col items-end gap-4"
                >
                  {/* Handle Option Groups */}
                  {activeToolOptions.optionGroups ? (
                    activeToolOptions.optionGroups.map((group, idx) => (
                      <div key={idx} className="flex flex-col items-end gap-2">
                        <div className="text-xs font-semibold text-black/50 uppercase tracking-wider mr-1">
                          {group.title}
                        </div>
                        <div className="flex flex-wrap gap-3 justify-end">
                          {group.options.map((option) => (
                            <button
                              key={option}
                              onClick={() => onSendMessage(undefined, option)}
                              className="bg-white/80 backdrop-blur-md border border-black/5 px-6 py-3 rounded-full text-sm font-medium hover:bg-black hover:text-white transition-all shadow-lg shadow-black/5 hover:scale-105 active:scale-95"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : activeToolOptions.options ? (
                    /* Handle Flat Options */
                    <div className="flex flex-wrap gap-3 justify-end">
                      {activeToolOptions.options.map((option) => (
                        <button
                          key={option}
                          onClick={() => onSendMessage(undefined, option)}
                          className="bg-white/80 backdrop-blur-md border border-black/5 px-6 py-3 rounded-full text-sm font-medium hover:bg-black hover:text-white transition-all shadow-lg shadow-black/5 hover:scale-105 active:scale-95"
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input Area */}
            <form
              onSubmit={onSendMessage}
              className="relative flex items-center gap-4"
            >
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={userInput || ""}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type your answer..."
                  className="w-full bg-white/50 backdrop-blur-xl border border-black/5 rounded-full px-8 py-5 text-lg font-medium text-black placeholder:text-black/20 focus:outline-none focus:ring-2 focus:ring-black/5 focus:bg-white transition-all shadow-lg shadow-black/[0.02]"
                  autoFocus
                />
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <button
                type="submit"
                disabled={!(userInput || "").trim() || isAiThinking}
                className="w-16 h-16 rounded-full bg-black flex items-center justify-center text-white disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10"
              >
                {isAiThinking ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <ArrowRight className="w-6 h-6" />
                )}
              </button>
            </form>
          </div>
        </motion.div>
      )}

      {phase === "synthesis" && (
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
                  <p className="text-sm font-medium text-black/60">
                    目标：{goal}
                  </p>
                </div>

                {/* Level Description - The AI's Detective Conclusion */}
                {config.levelDescription && (
                  <div className="flex items-start gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-black mt-1.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-black/60 mb-1">
                        深度评估：
                      </p>
                      <p className="text-sm font-bold text-black italic leading-relaxed">
                        "{config.levelDescription}"
                      </p>
                    </div>
                  </div>
                )}

                {!config.levelDescription && config.level && (
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    <p className="text-sm font-medium text-black/60">
                      深度：{config.level}
                    </p>
                  </div>
                )}

                {config.targetOutcome && (
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    <p className="text-sm font-medium text-black/60">
                      预期成果：{config.targetOutcome}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 text-black pt-4 border-t border-black/5">
                  <Check className="w-4 h-4" />
                  <p className="text-sm font-bold italic">
                    “已为你优化知识关联，准备生成结构。”
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

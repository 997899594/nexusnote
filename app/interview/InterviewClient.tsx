"use client";

/**
 * Interview Client Component
 *
 * 处理所有客户端交互：useChat、动画、状态管理
 */

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface TextPart {
  type: "text";
  text: string;
}

type ContentPart = TextPart;

function getMessageContent(msg: { parts?: ContentPart[] }): string {
  if (!msg?.parts) return "";
  return msg.parts
    .filter((p): p is TextPart => p?.type === "text" && "text" in p)
    .map((p) => p.text)
    .join("");
}

export function InterviewClient() {
  const [state, setState] = useState({
    phase: "greeting" as "greeting" | "topic" | "background" | "difficulty" | "generating" | "complete",
    topic: "",
    background: "",
    difficulty: "intermediate" as "beginner" | "intermediate" | "advanced",
    courseId: null as string | null,
  });

  const chat = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({ intent: "INTERVIEW" }),
    }),
  });

  const messages = chat.messages || [];
  const isLoading = (chat.status as string) !== "success";
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  const handleOptionSelect = () => {
    if (state.phase === "greeting") {
      setState((s) => ({ ...s, phase: "topic" }));
      chat.sendMessage?.({ text: "我想创建课程" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-3xl w-full"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header style={{ padding: "20px 0", borderBottom: "1px solid #eee", marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: "bold" }}>学习需求访谈</h1>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {["greeting", "topic", "background", "difficulty", "complete"].map((p, i) => (
            <motion.div
              key={p}
              animate={{
                backgroundColor:
                  ["greeting", "topic", "background", "difficulty", "complete"].indexOf(state.phase) >= i
                    ? "#6366f1"
                    : "#eee",
              }}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
              }}
            />
          ))}
        </div>
      </header>

      <div style={{ flex: 1, overflowY: "auto" }}>
        <AnimatePresence mode="wait">
          {state.phase === "greeting" && (
            <motion.div
              key="greeting"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{ textAlign: "center", padding: "40px 0" }}
            >
              <motion.h2
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
                style={{ fontSize: 20, marginBottom: 16 }}
              >
                欢迎来到 NexusNote AI
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                style={{ color: "#666", marginBottom: 24 }}
              >
                让我们一起创建你的个性化课程
              </motion.p>
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleOptionSelect}
                style={{
                  padding: "14px 32px",
                  background: "#6366f1",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                开始创建课程
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: "70%",
                  padding: "12px 16px",
                  borderRadius: 12,
                  background: m.role === "user" ? "#6366f1" : "#f5f5f5",
                  color: m.role === "user" ? "#fff" : "#333",
                }}
              >
                {getMessageContent(m as { parts?: ContentPart[] })}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {state.phase !== "greeting" && state.phase !== "complete" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ paddingTop: 16, borderTop: "1px solid #eee" }}
        >
          <input
            placeholder="输入你的回答..."
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #ddd",
              borderRadius: 8,
              fontSize: 16,
            }}
          />
        </motion.div>
      )}
    </motion.div>
  );
}

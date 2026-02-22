"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { useChatStore } from "@/ui/chat";
import { HeroInput, RecentSection } from "@/components/shared/home";
import { FloatingHeader } from "@/components/shared/layout";

export default function HomePage() {
  const loadSessions = useChatStore((state) => state.loadSessions);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return (
    <main className="min-h-screen bg-slate-50">
      <FloatingHeader />

      <div className="max-w-4xl mx-auto px-6 pt-28 pb-20">
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-14"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 mb-3 tracking-tight">
            你的私人学习顾问
          </h1>
          <p className="text-lg text-zinc-500">让 AI 为你规划、记忆、测评</p>
        </motion.header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-14"
        >
          <HeroInput />
        </motion.div>

        <RecentSection />
      </div>
    </main>
  );
}

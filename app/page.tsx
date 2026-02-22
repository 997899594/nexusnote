"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { useChatStore } from "@/components/chat";
import { useAuthStore } from "@/components/auth";
import { HeroInput, RecentSection } from "@/components/shared/home";
import { FloatingHeader } from "@/components/shared/layout";

export default function HomePage() {
  const loadSessions = useChatStore((state) => state.loadSessions);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    // Show login prompt after 1s if not authenticated
    if (!isAuthenticated) {
      const timer = setTimeout(() => {
        setShowAuthPrompt(true);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setShowAuthPrompt(false);
    }
  }, [isAuthenticated]);

  const handleLoginClick = () => {
    router.push("/login");
  };

  return (
    <main className="min-h-screen bg-slate-50">
      <FloatingHeader />

      {/* Login Prompt for Unauthenticated Users */}
      {showAuthPrompt && !isAuthenticated && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-blue-600 text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-4">
            <div className="flex items-center gap-3">
              <LogIn className="w-5 h-5" />
              <span className="font-medium">登录以保存你的学习记录</span>
            </div>
            <button
              onClick={handleLoginClick}
              className="ml-4 px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
            >
              立即登录
            </button>
          </div>
        </motion.div>
      )}

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

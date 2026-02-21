/**
 * Login Page - 2026 Modern Design
 *
 * 简化自 Legacy，保留核心设计元素
 */

"use client";

import { motion } from "framer-motion";
import { Brain, Github, Mail } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn("credentials", { email, name, callbackUrl: "/" });
    } catch (error) {
      console.error("Login failed", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200"
      >
        <div className="p-8">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <div className="p-3 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200">
              <Brain className="w-8 h-8 text-white" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-center text-slate-900 mb-2"
          >
            NexusNote
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-slate-500 text-center mb-8"
          >
            AI-Powered second brain
          </motion.p>

          {/* Social Login */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => signIn("github", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700"
            >
              <Github className="w-5 h-5" />
              Continue with GitHub
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors font-medium text-slate-700"
            >
              <Mail className="w-5 h-5 text-red-500" />
              Continue with Google
            </motion.button>
          </motion.div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-white text-slate-400">Or development login</span>
            </div>
          </div>

          {/* Dev Login Form */}
          <motion.form
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onSubmit={handleDevLogin}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <motion.input
                whileFocus={{ scale: 1.01 }}
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Name (optional)
              </label>
              <motion.input
                whileFocus={{ scale: 1.01 }}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              />
            </div>
            <motion.button
              whileHover={email ? { scale: 1.02 } : {}}
              whileTap={email ? { scale: 0.98 } : {}}
              type="submit"
              disabled={loading || !email}
              className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
            >
              {loading ? "Signing in..." : "Continue with Email"}
            </motion.button>
          </motion.form>
        </div>
      </motion.div>
    </div>
  );
}

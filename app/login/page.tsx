"use client";

export const dynamic = "force-dynamic";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Brain, CheckCircle2, Github, Loader2, Mail } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { cn } from "@/lib/utils";

function LoginForm() {
  const searchParams = useSearchParams();
  const isVerifyPage = searchParams.get("verify") === "1";

  const [email, setEmail] = useState("");
  const [devName, setDevName] = useState("");
  const [sent, setSent] = useState(isVerifyPage);
  const [sentEmail, setSentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDev, setShowDev] = useState(false);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn("resend", { email, redirect: false });
      if (result?.error) {
        setError("发送失败，请稍后重试");
      } else {
        setSentEmail(email);
        setSent(true);
      }
    } catch {
      setError("发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn("credentials", { email, name: devName, callbackUrl: "/" });
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="max-w-md w-full bg-[var(--color-surface)] rounded-2xl shadow-[var(--shadow-elevated)] overflow-hidden"
      >
        <div className="p-8">
          {/* Logo */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <div className="p-3 bg-[var(--color-accent)] rounded-xl shadow-lg">
              <Brain className="w-8 h-8 text-[var(--color-accent-fg)]" />
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {sent ? (
              /* ── Check your email state ── */
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-accent-subtle)] flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-[var(--color-accent)]" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">查收邮件</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">登录链接已发送至</p>
                <p className="text-sm font-medium text-[var(--color-text)] mb-6 break-all">
                  {sentEmail || email}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mb-6">
                  链接 15 分钟内有效，点击即可自动登录。没收到？检查垃圾邮件文件夹。
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                    setSentEmail("");
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  重新发送
                </button>
              </motion.div>
            ) : (
              /* ── Login form ── */
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <h1 className="text-2xl font-bold text-center text-[var(--color-text)] mb-1">
                  NexusNote
                </h1>
                <p className="text-[var(--color-text-tertiary)] text-center text-sm mb-8">
                  AI-powered second brain
                </p>

                {/* Magic Link form */}
                <form onSubmit={handleMagicLink} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="输入邮箱"
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-xl border bg-[var(--color-surface)]",
                        "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
                        "border-[var(--color-border)] focus:border-[var(--color-accent)]",
                        "focus:ring-2 focus:ring-[var(--color-accent)]/20 outline-none transition-all",
                      )}
                    />
                  </div>

                  {error && <p className="text-xs text-red-500 px-1">{error}</p>}

                  <motion.button
                    whileHover={email ? { scale: 1.01 } : {}}
                    whileTap={email ? { scale: 0.99 } : {}}
                    type="submit"
                    disabled={loading || !email}
                    className={cn(
                      "w-full py-3 px-4 rounded-xl font-medium text-sm transition-all",
                      "bg-[var(--color-accent)] text-[var(--color-accent-fg)]",
                      "hover:bg-[var(--color-accent-hover)]",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2",
                    )}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "发送登录链接"}
                  </motion.button>
                </form>

                {/* GitHub OAuth */}
                {process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true" && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-[var(--color-border)]" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-3 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface)]">
                          或
                        </span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      type="button"
                      onClick={() => signIn("github", { callbackUrl: "/" })}
                      className={cn(
                        "w-full flex items-center justify-center gap-2.5 px-4 py-3",
                        "border border-[var(--color-border)] rounded-xl",
                        "hover:bg-[var(--color-hover)] transition-colors",
                        "text-sm font-medium text-[var(--color-text-secondary)]",
                      )}
                    >
                      <Github className="w-4 h-4" />
                      Continue with GitHub
                    </motion.button>
                  </>
                )}

                {/* Dev login — development only */}
                {process.env.NODE_ENV === "development" && (
                  <div className="mt-8">
                    <button
                      type="button"
                      onClick={() => setShowDev((v) => !v)}
                      className="w-full text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors py-1"
                    >
                      {showDev ? "收起" : "开发模式登录"}
                    </button>

                    <AnimatePresence>
                      {showDev && (
                        <motion.form
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          onSubmit={handleDevLogin}
                          className="mt-3 space-y-2 overflow-hidden"
                        >
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="demo@example.com"
                            className={cn(
                              "w-full px-3 py-2 rounded-lg border text-sm",
                              "border-[var(--color-border)] bg-[var(--color-bg)]",
                              "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
                              "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]",
                            )}
                          />
                          <input
                            type="text"
                            value={devName}
                            onChange={(e) => setDevName(e.target.value)}
                            placeholder="名字（可选）"
                            className={cn(
                              "w-full px-3 py-2 rounded-lg border text-sm",
                              "border-[var(--color-border)] bg-[var(--color-bg)]",
                              "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
                              "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]",
                            )}
                          />
                          <button
                            type="submit"
                            disabled={loading || !email}
                            className={cn(
                              "w-full py-2 rounded-lg text-sm font-medium transition-colors",
                              "bg-[var(--color-muted)] text-[var(--color-text-secondary)]",
                              "hover:bg-[var(--color-hover)] disabled:opacity-50",
                            )}
                          >
                            直接登录（Dev）
                          </button>
                        </motion.form>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-bg)]" />}>
      <LoginForm />
    </Suspense>
  );
}

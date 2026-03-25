"use client";

export const dynamic = "force-dynamic";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Brain, CheckCircle2, Github, Loader2, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function getSafeCallbackUrl(callbackUrl: string | null): string {
  if (!callbackUrl) return "/";
  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const isVerifyPage = searchParams.get("verify") === "1";
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [devName, setDevName] = useState("");
  const [sent, setSent] = useState(isVerifyPage);
  const [sentEmail, setSentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showDev, setShowDev] = useState(false);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn("resend", {
        email,
        redirect: false,
        callbackUrl,
      });
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
      await signIn("credentials", { email, name: devName, callbackUrl });
    } catch {
      setError("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ui-page-shell flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="ui-surface-card-lg w-full max-w-md overflow-hidden rounded-3xl"
      >
        <div className="p-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
            className="flex justify-center mb-6"
          >
            <div className="ui-primary-button rounded-2xl p-3">
              <Brain className="w-8 h-8 text-white" />
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
                  <div className="ui-surface-soft flex h-16 w-16 items-center justify-center rounded-full">
                    <CheckCircle2 className="w-8 h-8 text-[#111827]" />
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
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="mb-8 text-center">
                  <div className="ui-surface-soft inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.22em] text-black/45">
                    <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
                    学习账户
                  </div>
                  <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                    登录后继续学习
                  </h1>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-tertiary)]">
                    登录你的 NexusNote 账户，继续课程、笔记和学习进度。
                  </p>
                </div>

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
                        "w-full rounded-xl bg-[#f7f8fa] pl-10 pr-4 py-3",
                        "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
                        "focus:ring-2 focus:ring-[var(--color-accent)]/15 outline-none transition-all",
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
                      "ui-primary-button",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center justify-center gap-2",
                    )}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "发送登录链接"}
                  </motion.button>
                </form>

                {process.env.NEXT_PUBLIC_GITHUB_ENABLED === "true" && (
                  <>
                    <div className="relative my-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-black/8" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-3 text-xs text-[var(--color-text-muted)]">
                          或
                        </span>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      type="button"
                      onClick={() => signIn("github", { callbackUrl })}
                      className={cn(
                        "w-full flex items-center justify-center gap-2.5 px-4 py-3",
                        "rounded-xl bg-[#f7f8fa] hover:bg-[#eef1f5] transition-colors",
                        "text-sm font-medium text-[var(--color-text-secondary)]",
                      )}
                    >
                      <Github className="w-4 h-4" />
                      Continue with GitHub
                    </motion.button>
                  </>
                )}

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
                              "w-full rounded-lg bg-[#f7f8fa] px-3 py-2 text-sm",
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
                              "w-full rounded-lg bg-[#f7f8fa] px-3 py-2 text-sm",
                              "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
                              "focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]",
                            )}
                          />
                          <button
                            type="submit"
                            disabled={loading || !email}
                            className={cn(
                              "w-full py-2 rounded-lg text-sm font-medium transition-colors",
                              "bg-[#f3f5f8] text-[var(--color-text-secondary)]",
                              "hover:bg-[#eceff3] disabled:opacity-50",
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

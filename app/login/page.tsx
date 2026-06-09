"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Loader2, Mail, Wrench } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const IS_DEV_LOGIN_ENABLED = process.env.NODE_ENV !== "production";

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

  const [providerIds, setProviderIds] = useState<Set<string> | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isResendLoginEnabled = providerIds?.has("resend") ?? false;

  useEffect(() => {
    let active = true;
    getProviders().then((providers) => {
      if (!active) {
        return;
      }
      setProviderIds(new Set(Object.keys(providers ?? {})));
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSent(isVerifyPage && isResendLoginEnabled);
  }, [isResendLoginEnabled, isVerifyPage]);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(callbackUrl);
    }
  }, [callbackUrl, router, status]);

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !isResendLoginEnabled) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn("resend", {
        email: normalizedEmail,
        redirect: false,
        callbackUrl,
      });
      if (result?.error) {
        setError("发送失败，请稍后重试");
      } else {
        setEmail(normalizedEmail);
        setSentEmail(normalizedEmail);
        setSent(true);
      }
    } catch {
      setError("发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = () => {
    const params = new URLSearchParams({ callbackUrl });
    window.location.assign(`/api/auth/dev-login?${params.toString()}`);
  };

  return (
    <div className="ui-page-shell flex min-h-screen items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="ui-surface-card-lg w-full max-w-md overflow-hidden rounded-[28px]"
      >
        <div className="p-7 sm:p-8">
          <AnimatePresence mode="wait">
            {sent ? (
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center"
              >
                <div className="mb-5 flex justify-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-panel-soft)] text-[var(--color-text)]">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                </div>
                <h2 className="mb-2 text-xl font-semibold tracking-[-0.03em] text-[var(--color-text)]">
                  查收登录邮件
                </h2>
                <p className="mx-auto max-w-sm text-sm leading-7 text-[var(--color-text-secondary)]">
                  点击邮件里的登录按钮即可进入。链接短时间内可重复使用，邮件客户端或安全扫描先打开也不会立刻失效。
                </p>
                <p className="mt-3 break-all rounded-2xl bg-[var(--color-panel-soft)] px-4 py-3 text-sm font-medium text-[var(--color-text)]">
                  {sentEmail || email}
                </p>

                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setError("");
                    }}
                    className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    换邮箱或重新发送
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="mb-8 text-center">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                    NexusNote
                  </p>
                  <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                    登录后继续学习
                  </h1>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-tertiary)]">
                    输入邮箱获取登录链接，继续课程、笔记和学习进度。
                  </p>
                </div>

                {providerIds === null ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-panel-soft)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在读取登录方式
                  </div>
                ) : null}

                {IS_DEV_LOGIN_ENABLED ? (
                  <button
                    type="button"
                    onClick={handleDevLogin}
                    className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-text)] px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
                  >
                    <Wrench className="h-4 w-4" />
                    开发环境直接登录
                  </button>
                ) : null}

                {isResendLoginEnabled ? (
                  <form onSubmit={handleMagicLink} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="输入邮箱"
                        className={cn(
                          "w-full rounded-xl bg-[var(--color-panel-soft)] py-3 pl-10 pr-4",
                          "text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
                          "outline-none transition-all focus:ring-2 focus:ring-[var(--color-accent)]/15",
                        )}
                      />
                    </div>

                    {error && <p className="px-1 text-xs text-red-500">{error}</p>}

                    <motion.button
                      whileHover={email ? { scale: 1.01 } : {}}
                      whileTap={email ? { scale: 0.99 } : {}}
                      type="submit"
                      disabled={loading || !email}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-sm transition-all",
                        "ui-primary-button",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                      )}
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "发送登录邮件"}
                    </motion.button>
                  </form>
                ) : null}

                {providerIds !== null && !isResendLoginEnabled ? (
                  <div className="rounded-2xl bg-[var(--color-panel-soft)] px-4 py-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                    当前环境未启用邮件登录，请检查 Resend 配置后再试。
                  </div>
                ) : null}
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

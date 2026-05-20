"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Brain, CheckCircle2, Loader2, Mail } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const EMAIL_LOGIN_CODE_LENGTH = 8;

function getSafeCallbackUrl(callbackUrl: string | null): string {
  if (!callbackUrl) return "/";
  return callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
}

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status } = useSession();
  const isVerifyPage = searchParams.get("verify") === "1";
  const emailFromLink = searchParams.get("email");
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));

  const [providerIds, setProviderIds] = useState<Set<string> | null>(null);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
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
    if (!emailFromLink || !emailFromLink.includes("@")) {
      return;
    }
    setEmail((current) => current || emailFromLink);
  }, [emailFromLink]);

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
        setCode("");
        setSent(true);
      }
    } catch {
      setError("发送失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedCode = code.replace(/\D/g, "");
    const targetEmail = (sentEmail || email).trim().toLowerCase();

    if (normalizedCode.length !== EMAIL_LOGIN_CODE_LENGTH || !targetEmail) {
      setError(`请输入邮件里的 ${EMAIL_LOGIN_CODE_LENGTH} 位验证码`);
      return;
    }

    setVerifying(true);
    setError("");

    const params = new URLSearchParams({
      callbackUrl,
      token: normalizedCode,
      email: targetEmail,
    });
    window.location.assign(`/api/auth/callback/resend?${params.toString()}`);
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
              <motion.div
                key="sent"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center"
              >
                <div className="flex justify-center mb-4">
                  <div className="ui-surface-soft flex h-16 w-16 items-center justify-center rounded-full">
                    <CheckCircle2 className="w-8 h-8 text-[var(--color-text)]" />
                  </div>
                </div>
                <h2 className="mb-2 font-bold text-[var(--color-text)] text-xl">查收登录邮件</h2>
                <p className="mb-1 text-[var(--color-text-secondary)] text-sm">
                  可以点击邮件里的登录按钮，也可以输入验证码
                </p>
                <p className="mb-5 break-all font-medium text-[var(--color-text)] text-sm">
                  {sentEmail || email}
                </p>
                <form onSubmit={handleVerifyCode} className="space-y-3 text-left">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern={`[0-9]{${EMAIL_LOGIN_CODE_LENGTH}}`}
                    maxLength={EMAIL_LOGIN_CODE_LENGTH}
                    value={code}
                    onChange={(event) => {
                      setCode(
                        event.target.value.replace(/\D/g, "").slice(0, EMAIL_LOGIN_CODE_LENGTH),
                      );
                    }}
                    placeholder={`${EMAIL_LOGIN_CODE_LENGTH} 位验证码`}
                    className={cn(
                      "w-full rounded-2xl bg-[var(--color-panel-soft)] px-4 py-3 text-center",
                      "font-semibold text-[1.35rem] tracking-[0.24em] text-[var(--color-text)]",
                      "placeholder:font-medium placeholder:tracking-normal placeholder:text-[var(--color-text-muted)]",
                      "outline-none transition-all focus:ring-2 focus:ring-[var(--color-accent)]/15",
                    )}
                  />

                  {error && <p className="px-1 text-red-500 text-xs">{error}</p>}

                  <motion.button
                    whileHover={code.length === EMAIL_LOGIN_CODE_LENGTH ? { scale: 1.01 } : {}}
                    whileTap={code.length === EMAIL_LOGIN_CODE_LENGTH ? { scale: 0.99 } : {}}
                    type="submit"
                    disabled={verifying || code.length !== EMAIL_LOGIN_CODE_LENGTH}
                    className={cn(
                      "ui-primary-button flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium text-sm transition-all",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                    )}
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "完成登录"}
                  </motion.button>

                  <p className="pt-2 text-center text-[var(--color-text-muted)] text-xs leading-6">
                    如果邮件客户端先打开了链接，10 分钟内复制同一链接到默认浏览器仍可继续使用。
                    不想点链接时，输入验证码即可。
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setSent(false);
                      setCode("");
                      setError("");
                    }}
                    className="mx-auto inline-flex items-center gap-1.5 text-[var(--color-text-secondary)] text-sm transition-colors hover:text-[var(--color-text)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    换邮箱或重新发送
                  </button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="mb-8 text-center">
                  <div className="ui-surface-soft ui-page-eyebrow inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.22em]">
                    <span className="ui-strong-chip h-1.5 w-1.5 rounded-full" />
                    账户登录
                  </div>
                  <h1 className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[var(--color-text)]">
                    登录后继续学习
                  </h1>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-text-tertiary)]">
                    输入邮箱获取登录链接和验证码，继续课程、笔记和学习进度。
                  </p>
                </div>

                {providerIds === null ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl bg-[var(--color-panel-soft)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在读取登录方式
                  </div>
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

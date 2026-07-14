"use client";

import { Check, Loader2, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type {
  PricingAccountStatus,
  PricingCatalog,
  PricingPeriod,
} from "@/lib/billing/product-catalog";
import { cn } from "@/lib/utils";

interface PricingClientProps {
  account: PricingAccountStatus;
  catalog: PricingCatalog;
}

type PlanPeriod = PricingPeriod["id"];

function formatYuan(amountCents: number): string {
  const amount = amountCents / 100;
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(1);
}

function formatExpiry(expiresAt: string | null): string | null {
  if (!expiresAt) {
    return null;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(expiresAt));
}

function getUpgradeLabel(account: PricingAccountStatus, isCheckingOut: boolean): string {
  if (isCheckingOut) {
    return "正在创建订单";
  }

  switch (account.kind) {
    case "anonymous":
      return "登录后升级";
    case "trial":
      return "升级并延长 Pro";
    case "pro":
      return "续费 Pro";
    case "free":
      return "升级到 Pro";
  }
}

export function PricingClient({ account, catalog }: PricingClientProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<PlanPeriod>("month");
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const currentPeriod = catalog.periods[period];
  const expiryLabel = formatExpiry(account.expiresAt);

  const handleUpgrade = async () => {
    if (account.kind === "anonymous") {
      router.push("/login");
      return;
    }

    setIsCheckingOut(true);
    setCheckoutError(null);

    try {
      const origin = window.location.origin;
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: currentPeriod.planId,
          returnUrl: `${origin}/profile/settings`,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error?.message || data?.message || "创建订单失败");
      }

      const data = (await response.json()) as { checkoutUrl?: string | null };
      if (!data.checkoutUrl) {
        throw new Error("支付通道尚未配置");
      }

      window.location.href = data.checkoutUrl;
    } catch (error) {
      console.error("Checkout error:", error);
      setCheckoutError(error instanceof Error ? error.message : "创建订单失败");
      setIsCheckingOut(false);
    }
  };

  const proBadge =
    account.kind === "trial" ? "试用中" : account.kind === "pro" ? "当前权益" : "推荐";

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
      <section className="flex flex-col rounded-3xl border border-[var(--color-active)] bg-[var(--color-surface)] p-6 md:p-8">
        <div>
          <p className="text-sm font-medium uppercase text-[var(--color-text-muted)]">Free</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-[var(--color-text)]">¥0</span>
            <span className="text-sm text-[var(--color-text-muted)]">/ 月</span>
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">基础能力永久保留</p>
        </div>

        <ul className="mt-8 flex-1 space-y-3">
          {catalog.freeFeatures.map((feature) => (
            <li key={feature.id} className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">{feature.label}</span>
            </li>
          ))}
        </ul>

        <Link
          href={account.kind === "anonymous" ? "/login" : "/"}
          className={cn(
            "mt-8 flex items-center justify-center gap-2 rounded-2xl border border-[var(--color-active)] px-6 py-3 text-sm font-medium transition-colors",
            "text-[var(--color-text)] hover:bg-[var(--color-active)]",
          )}
        >
          {account.kind === "anonymous"
            ? "免费开始"
            : account.kind === "free"
              ? "当前方案"
              : "继续使用基础能力"}
        </Link>
      </section>

      <section className="relative flex flex-col rounded-3xl border-2 border-[var(--color-accent)] bg-[var(--color-surface)] p-6 shadow-lg md:p-8">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-accent)] px-4 py-1 text-xs font-medium text-white">
            <Sparkles className="h-3 w-3" />
            {proBadge}
          </span>
        </div>

        <div>
          <p className="text-sm font-medium uppercase text-[var(--color-accent)]">Pro</p>
          <div className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl font-bold text-[var(--color-text)]">
              ¥{formatYuan(currentPeriod.amountCents)}
            </span>
            <span className="text-sm text-[var(--color-text-muted)]">
              {period === "month"
                ? "/ 月"
                : `/ 年（¥${formatYuan(currentPeriod.monthlyEquivalentCents)} / 月）`}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {account.kind === "trial" && expiryLabel
              ? `试用有效至 ${expiryLabel}`
              : account.kind === "pro" && expiryLabel
                ? `Pro 有效至 ${expiryLabel}`
                : `${catalog.trialDays} 天免费试用，无需绑定支付`}
          </p>
        </div>

        <div className="mt-4 flex rounded-xl bg-[var(--color-active)] p-1">
          {(["month", "year"] as PlanPeriod[]).map((periodId) => {
            const option = catalog.periods[periodId];
            return (
              <button
                key={periodId}
                type="button"
                onClick={() => setPeriod(periodId)}
                className={cn(
                  "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  period === periodId
                    ? "bg-white text-[var(--color-text)] shadow-sm"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {periodId === "month" ? "月付" : `年付（省 ${option.savingsPercent}%）`}
              </button>
            );
          })}
        </div>

        <ul className="mt-8 flex-1 space-y-3">
          {catalog.proFeatures.map((feature) => (
            <li key={feature.id} className="flex items-start gap-3">
              <Zap className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-accent)]" />
              <span className="text-sm text-[var(--color-text)]">{feature.label}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => void handleUpgrade()}
          disabled={isCheckingOut}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCheckingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {getUpgradeLabel(account, isCheckingOut)}
        </button>
        {checkoutError ? (
          <p role="alert" className="mt-3 text-center text-sm text-[var(--color-panel-strong)]">
            {checkoutError}
          </p>
        ) : null}
      </section>
    </div>
  );
}

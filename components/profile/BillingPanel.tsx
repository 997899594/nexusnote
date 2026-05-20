"use client";

import { CreditCard, KeyRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

interface BillingPlan {
  id: "pro_month" | "pro_year";
  name: string;
  amountCents: number;
  currency: string;
  entitlementDays: number;
}

interface BillingState {
  plan: string;
  entitlement: {
    plan: string;
    expiresAt: string;
  } | null;
  plans: BillingPlan[];
}

function formatPrice(plan: BillingPlan): string {
  return `${plan.currency === "CNY" ? "¥" : plan.currency} ${(plan.amountCents / 100).toFixed(0)}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function BillingPanel() {
  const [state, setState] = useState<BillingState | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/billing/me");
    if (response.ok) {
      setState(await response.json());
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function startCheckout(plan: BillingPlan) {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: plan.id,
          returnUrl: window.location.href,
        }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error?.message ?? "创建订单失败");
        return;
      }

      if (payload.checkoutUrl) {
        window.location.href = payload.checkoutUrl;
        return;
      }

      setMessage(`订单已创建：${payload.order.id}。支付通道未配置，可先人工收款后发兑换码。`);
    } finally {
      setIsLoading(false);
    }
  }

  async function redeem() {
    if (!code.trim()) {
      return;
    }

    setIsLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/billing/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error?.message ?? "兑换失败");
        return;
      }

      setCode("");
      setMessage("已开通 Pro。");
      await refresh();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="ui-surface-card-lg border border-black/6 p-5 md:p-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--color-text-tertiary)]">会员权益</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--color-text)]">NexusNote Pro</h2>
        </div>
        <div className="rounded-full bg-[var(--color-panel-soft)] px-3 py-1 text-sm text-[var(--color-text-secondary)]">
          {state?.entitlement ? `Pro 至 ${formatDate(state.entitlement.expiresAt)}` : "当前 Free"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {(state?.plans ?? []).map((plan) => (
          <button
            key={plan.id}
            type="button"
            disabled={isLoading}
            onClick={() => void startCheckout(plan)}
            className="rounded-2xl border border-black/6 bg-white p-4 text-left transition-colors hover:bg-[var(--color-hover)] disabled:opacity-60"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-[var(--color-text)]">{plan.name}</span>
              <CreditCard className="h-4 w-4 text-[var(--color-text-tertiary)]" />
            </div>
            <div className="mt-3 text-2xl font-semibold text-[var(--color-text)]">
              {formatPrice(plan)}
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              开通 {plan.entitlementDays} 天 Pro 权益
            </p>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-black/6 bg-[var(--color-panel-soft)] p-3 md:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-white px-3 py-2">
          <KeyRound className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="输入兑换码"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-muted)]"
          />
        </div>
        <button
          type="button"
          disabled={isLoading || !code.trim()}
          onClick={() => void redeem()}
          className="ui-primary-button rounded-xl px-4 py-2 text-sm disabled:opacity-60"
        >
          兑换
        </button>
      </div>

      {message && <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{message}</p>}
    </section>
  );
}

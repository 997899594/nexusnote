import { Suspense } from "react";
import { FloatingHeader, LandingPageShell } from "@/components/shared/layout";
import { getDynamicPageSession } from "@/lib/auth/page";
import { getUserEntitlementStatus } from "@/lib/billing/entitlements";
import { BillingPlanIdSchema } from "@/lib/billing/plans";
import { getPricingCatalog, type PricingAccountStatus } from "@/lib/billing/product-catalog";
import { PricingClient } from "./PricingClient";

async function PricingContent() {
  const session = await getDynamicPageSession();
  const userId = session?.user?.id;
  const entitlement = userId ? await getUserEntitlementStatus(userId) : null;
  const planResult = BillingPlanIdSchema.safeParse(entitlement?.plan);
  const account: PricingAccountStatus = !userId
    ? { kind: "anonymous", planId: null, expiresAt: null, permanent: false }
    : entitlement?.isTrialing
      ? {
          kind: "trial",
          planId: planResult.success ? planResult.data : null,
          expiresAt: entitlement.expiresAt?.toISOString() ?? null,
          permanent: false,
        }
      : entitlement?.isPro
        ? {
            kind: "pro",
            planId: planResult.success ? planResult.data : null,
            expiresAt: entitlement.expiresAt?.toISOString() ?? null,
            permanent: entitlement.expiresAt == null,
          }
        : { kind: "free", planId: null, expiresAt: null, permanent: false };

  return <PricingClient account={account} catalog={getPricingCatalog()} />;
}

export default function PricingPage() {
  return (
    <LandingPageShell
      header={<FloatingHeader title="定价" subtitle="NexusNote" variant="compact" />}
    >
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-[var(--color-text)] md:text-3xl">
          简单定价，专注学习
        </h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          基础聊天永久免费，新账号自动获得 7 天 Pro 试用
        </p>
      </div>

      <Suspense
        fallback={<div className="h-64 animate-pulse rounded-2xl bg-[var(--color-active)]" />}
      >
        <PricingContent />
      </Suspense>
    </LandingPageShell>
  );
}

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import {
  billingOrders,
  billingWebhookEvents,
  db,
  redeemCodeRedemptions,
  redeemCodes,
  userEntitlements,
  users,
} from "@/db";
import { badRequest, conflict, notFound } from "@/lib/api/errors";
import { getActiveProductAccessGrant } from "./capability-access";
import type { BillingPlanId } from "./plans";
import { getBillingPlan } from "./plans";
import { hashRedeemCode } from "./redeem-codes";

const TRIAL_DAYS = 7;

type BillingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type UserEntitlement = typeof userEntitlements.$inferSelect;

interface GrantEntitlementParams {
  userId: string;
  plan: BillingPlanId;
  source: string;
  sourceRefId: string;
  entitlementDays?: number;
  metadata?: Record<string, unknown>;
}

export interface BillingWebhookEventInput {
  provider: string;
  eventId: string;
  payload: Record<string, unknown>;
  signature?: string | null;
}

interface PaidBillingWebhookInput {
  event: BillingWebhookEventInput;
  orderId: string;
  providerOrderId?: string | null;
  providerTransactionId?: string | null;
  paidAt?: Date;
  amountCents?: number;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function lockUser(tx: BillingTransaction, userId: string): Promise<void> {
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .for("update")
    .limit(1);

  if (!user) {
    throw notFound("用户不存在", "USER_NOT_FOUND");
  }
}

async function getActiveEntitlementInTransaction(
  tx: BillingTransaction,
  userId: string,
): Promise<UserEntitlement | null> {
  const [entitlement] = await tx
    .select()
    .from(userEntitlements)
    .where(
      and(
        eq(userEntitlements.userId, userId),
        isNull(userEntitlements.revokedAt),
        gt(userEntitlements.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(userEntitlements.expiresAt))
    .limit(1);

  return entitlement ?? null;
}

async function grantEntitlementInTransaction(
  tx: BillingTransaction,
  params: GrantEntitlementParams,
): Promise<UserEntitlement> {
  const [existing] = await tx
    .select()
    .from(userEntitlements)
    .where(
      and(
        eq(userEntitlements.source, params.source),
        eq(userEntitlements.sourceRefId, params.sourceRefId),
      ),
    )
    .limit(1);

  if (existing) {
    return existing;
  }

  const plan = getBillingPlan(params.plan);
  const now = new Date();
  const active = await getActiveEntitlementInTransaction(tx, params.userId);
  const startsAt = active && active.expiresAt > now ? active.expiresAt : now;
  const expiresAt = addDays(startsAt, params.entitlementDays ?? plan.entitlementDays);

  const [entitlement] = await tx
    .insert(userEntitlements)
    .values({
      userId: params.userId,
      plan: params.plan,
      source: params.source,
      sourceRefId: params.sourceRefId,
      startsAt,
      expiresAt,
      metadata: params.metadata ?? {},
    })
    .returning();

  if (!entitlement) {
    throw new Error("Failed to create user entitlement");
  }

  return entitlement;
}

export async function getActiveEntitlement(userId: string): Promise<UserEntitlement | null> {
  const [entitlement] = await db
    .select()
    .from(userEntitlements)
    .where(
      and(
        eq(userEntitlements.userId, userId),
        isNull(userEntitlements.revokedAt),
        gt(userEntitlements.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(userEntitlements.expiresAt))
    .limit(1);

  return entitlement ?? null;
}

export interface EntitlementStatus {
  isPro: boolean;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  plan: string | null;
  expiresAt: Date | null;
  source: string | null;
}

export async function getUserEntitlementStatus(userId: string): Promise<EntitlementStatus> {
  const grant = await getActiveProductAccessGrant(userId);
  if (grant) {
    return {
      isPro: true,
      isTrialing: false,
      trialEndsAt: null,
      plan: grant.plan,
      expiresAt: grant.expiresAt,
      source: grant.source,
    };
  }

  const entitlement = await getActiveEntitlement(userId);

  if (!entitlement) {
    return {
      isPro: false,
      isTrialing: false,
      trialEndsAt: null,
      plan: null,
      expiresAt: null,
      source: null,
    };
  }

  const isTrialing = entitlement.source === "trial";

  return {
    isPro: true,
    isTrialing,
    trialEndsAt: isTrialing ? entitlement.expiresAt : null,
    plan: entitlement.plan,
    expiresAt: entitlement.expiresAt,
    source: entitlement.source,
  };
}

export async function createTrialEntitlement(userId: string): Promise<void> {
  if (await getActiveProductAccessGrant(userId)) return;
  await db.transaction(async (tx) => {
    await lockUser(tx, userId);
    await grantEntitlementInTransaction(tx, {
      userId,
      plan: "pro_month",
      source: "trial",
      sourceRefId: `trial-${userId}`,
      entitlementDays: TRIAL_DAYS,
    });
  });
}

export async function recordBillingWebhookEvent(
  event: BillingWebhookEventInput,
): Promise<{ duplicate: boolean }> {
  const [inserted] = await db
    .insert(billingWebhookEvents)
    .values({
      ...event,
      processedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: billingWebhookEvents.id });

  return { duplicate: !inserted };
}

export async function processPaidBillingWebhook(
  params: PaidBillingWebhookInput,
): Promise<{ duplicate: boolean; entitlement: UserEntitlement | null }> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(billingWebhookEvents)
      .values(params.event)
      .onConflictDoNothing()
      .returning({ id: billingWebhookEvents.id });

    if (!event) {
      return { duplicate: true, entitlement: null };
    }

    const [order] = await tx
      .select()
      .from(billingOrders)
      .where(
        and(
          eq(billingOrders.id, params.orderId),
          eq(billingOrders.provider, params.event.provider),
        ),
      )
      .for("update")
      .limit(1);

    if (!order) {
      throw notFound("订单不存在", "BILLING_ORDER_NOT_FOUND");
    }

    if (params.amountCents != null && params.amountCents !== order.amountCents) {
      throw badRequest("支付金额不匹配", "BILLING_AMOUNT_MISMATCH");
    }

    await lockUser(tx, order.userId);

    await tx
      .update(billingOrders)
      .set({
        status: "paid",
        providerOrderId: params.providerOrderId ?? order.providerOrderId,
        paidAt: params.paidAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(billingOrders.id, order.id));

    const entitlement = await grantEntitlementInTransaction(tx, {
      userId: order.userId,
      plan: order.plan as BillingPlanId,
      source: "billing_order",
      sourceRefId: order.id,
      entitlementDays: order.entitlementDays,
      metadata: {
        provider: params.event.provider,
        providerOrderId: params.providerOrderId ?? null,
        providerTransactionId: params.providerTransactionId ?? null,
      },
    });

    await tx
      .update(billingWebhookEvents)
      .set({ processedAt: new Date() })
      .where(eq(billingWebhookEvents.id, event.id));

    return { duplicate: false, entitlement };
  });
}

export async function redeemCodeForUser(params: { userId: string; code: string }) {
  const codeHash = hashRedeemCode(params.code);

  return db.transaction(async (tx) => {
    const [code] = await tx
      .select()
      .from(redeemCodes)
      .where(eq(redeemCodes.codeHash, codeHash))
      .for("update")
      .limit(1);

    if (!code || code.disabledAt) {
      throw notFound("兑换码无效", "REDEEM_CODE_NOT_FOUND");
    }

    if (code.expiresAt && code.expiresAt <= new Date()) {
      throw conflict("兑换码已过期", "REDEEM_CODE_EXPIRED");
    }

    if (code.redeemedCount >= code.maxRedemptions) {
      throw conflict("兑换码已被使用", "REDEEM_CODE_EXHAUSTED");
    }

    await lockUser(tx, params.userId);

    const [existingRedemption] = await tx
      .select({ id: redeemCodeRedemptions.id })
      .from(redeemCodeRedemptions)
      .where(
        and(
          eq(redeemCodeRedemptions.codeId, code.id),
          eq(redeemCodeRedemptions.userId, params.userId),
        ),
      )
      .limit(1);

    if (existingRedemption) {
      throw conflict("兑换码已兑换", "REDEEM_CODE_ALREADY_USED");
    }

    const entitlement = await grantEntitlementInTransaction(tx, {
      userId: params.userId,
      plan: code.plan as BillingPlanId,
      source: "redeem_code",
      sourceRefId: `${code.id}:${params.userId}`,
      entitlementDays: code.entitlementDays,
      metadata: { codeId: code.id },
    });

    await tx.insert(redeemCodeRedemptions).values({
      codeId: code.id,
      userId: params.userId,
      entitlementId: entitlement.id,
    });

    await tx
      .update(redeemCodes)
      .set({ redeemedCount: sql`${redeemCodes.redeemedCount} + 1` })
      .where(eq(redeemCodes.id, code.id));

    return entitlement;
  });
}

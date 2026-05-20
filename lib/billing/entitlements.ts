import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { billingOrders, db, redeemCodeRedemptions, redeemCodes, userEntitlements } from "@/db";
import { badRequest, conflict, notFound } from "@/lib/api";
import type { BillingPlanId } from "./plans";
import { getBillingPlan } from "./plans";
import { hashRedeemCode } from "./redeem-codes";

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function getActiveEntitlement(userId: string) {
  const now = new Date();
  const [entitlement] = await db
    .select()
    .from(userEntitlements)
    .where(
      and(
        eq(userEntitlements.userId, userId),
        isNull(userEntitlements.revokedAt),
        gt(userEntitlements.expiresAt, now),
      ),
    )
    .orderBy(desc(userEntitlements.expiresAt))
    .limit(1);

  return entitlement ?? null;
}

export async function grantEntitlement(params: {
  userId: string;
  plan: BillingPlanId;
  source: string;
  sourceRefId: string;
  entitlementDays?: number;
  metadata?: Record<string, unknown>;
}) {
  const existing = await db
    .select()
    .from(userEntitlements)
    .where(
      and(
        eq(userEntitlements.source, params.source),
        eq(userEntitlements.sourceRefId, params.sourceRefId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const plan = getBillingPlan(params.plan);
  const now = new Date();
  const active = await getActiveEntitlement(params.userId);
  const startsAt = active && active.expiresAt > now ? active.expiresAt : now;
  const expiresAt = addDays(startsAt, params.entitlementDays ?? plan.entitlementDays);

  const [entitlement] = await db
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

  return entitlement;
}

export async function markOrderPaidAndGrantEntitlement(params: {
  orderId: string;
  provider: string;
  providerOrderId?: string | null;
  providerTransactionId?: string | null;
  paidAt?: Date;
  amountCents?: number;
}) {
  const [order] = await db
    .select()
    .from(billingOrders)
    .where(and(eq(billingOrders.id, params.orderId), eq(billingOrders.provider, params.provider)))
    .limit(1);

  if (!order) {
    throw notFound("订单不存在", "BILLING_ORDER_NOT_FOUND");
  }

  if (params.amountCents != null && params.amountCents !== order.amountCents) {
    throw badRequest("支付金额不匹配", "BILLING_AMOUNT_MISMATCH");
  }

  const paidAt = params.paidAt ?? new Date();
  const plan = order.plan as BillingPlanId;

  const [updatedOrder] = await db
    .update(billingOrders)
    .set({
      status: "paid",
      providerOrderId: params.providerOrderId ?? order.providerOrderId,
      paidAt,
      updatedAt: new Date(),
    })
    .where(eq(billingOrders.id, order.id))
    .returning();

  const entitlement = await grantEntitlement({
    userId: order.userId,
    plan,
    source: "billing_order",
    sourceRefId: order.id,
    entitlementDays: order.entitlementDays,
    metadata: {
      provider: params.provider,
      providerOrderId: params.providerOrderId ?? null,
      providerTransactionId: params.providerTransactionId ?? null,
    },
  });

  return { order: updatedOrder, entitlement };
}

export async function redeemCodeForUser(params: { userId: string; code: string }) {
  const codeHash = hashRedeemCode(params.code);
  const [code] = await db.select().from(redeemCodes).where(eq(redeemCodes.codeHash, codeHash));

  if (!code || code.disabledAt) {
    throw notFound("兑换码无效", "REDEEM_CODE_NOT_FOUND");
  }

  if (code.expiresAt && code.expiresAt <= new Date()) {
    throw conflict("兑换码已过期", "REDEEM_CODE_EXPIRED");
  }

  if (code.redeemedCount >= code.maxRedemptions) {
    throw conflict("兑换码已被使用", "REDEEM_CODE_EXHAUSTED");
  }

  const [existingRedemption] = await db
    .select()
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

  const entitlement = await grantEntitlement({
    userId: params.userId,
    plan: code.plan as BillingPlanId,
    source: "redeem_code",
    sourceRefId: `${code.id}:${params.userId}`,
    entitlementDays: code.entitlementDays,
    metadata: {
      codeId: code.id,
    },
  });

  await db.transaction(async (tx) => {
    await tx.insert(redeemCodeRedemptions).values({
      codeId: code.id,
      userId: params.userId,
      entitlementId: entitlement.id,
    });
    await tx
      .update(redeemCodes)
      .set({
        redeemedCount: sql`${redeemCodes.redeemedCount} + 1`,
      })
      .where(eq(redeemCodes.id, code.id));
  });

  return entitlement;
}

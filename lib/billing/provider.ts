import { z } from "zod";
import { env } from "@/config/env";
import { billingOrders, db, eq } from "@/db";
import { badRequest } from "@/lib/api";
import { createPay302Checkout } from "./302pay";
import { type BillingPlanId, getBillingPlan } from "./plans";
import { signBillingPayload } from "./signing";

export const CreateCheckoutInputSchema = z.object({
  plan: z.enum(["pro_month", "pro_year"]),
});

export async function createBillingCheckout(params: {
  userId: string;
  plan: BillingPlanId;
  returnUrl?: string;
  callbackUrl?: string;
}) {
  const plan = getBillingPlan(params.plan);
  const [order] = await db
    .insert(billingOrders)
    .values({
      userId: params.userId,
      provider: env.BILLING_PROVIDER,
      plan: plan.id,
      status: "pending",
      amountCents: plan.amountCents,
      currency: plan.currency,
      entitlementDays: plan.entitlementDays,
    })
    .returning();

  const checkout =
    env.BILLING_PROVIDER === "302pay"
      ? await buildPay302Checkout({
          orderId: order.id,
          plan: plan.id,
          amountCents: plan.amountCents,
          returnUrl: params.returnUrl,
          callbackUrl: params.callbackUrl,
        })
      : {
          providerOrderId: null,
          checkoutUrl: buildExternalCheckoutUrl({
            orderId: order.id,
            userId: params.userId,
            plan: plan.id,
            amountCents: plan.amountCents,
            currency: plan.currency,
            returnUrl: params.returnUrl,
          }),
          metadata: {},
        };

  await db
    .update(billingOrders)
    .set({
      providerOrderId: checkout.providerOrderId,
      providerCheckoutUrl: checkout.checkoutUrl,
      metadata: checkout.metadata,
      updatedAt: new Date(),
    })
    .where(eq(billingOrders.id, order.id));

  return {
    order: {
      id: order.id,
      provider: order.provider,
      plan: plan.id,
      amountCents: plan.amountCents,
      currency: plan.currency,
      status: order.status,
    },
    checkoutUrl: checkout.checkoutUrl,
  };
}

async function buildPay302Checkout(params: {
  orderId: string;
  plan: BillingPlanId;
  amountCents: number;
  returnUrl?: string;
  callbackUrl?: string;
}) {
  if (!params.returnUrl || !params.callbackUrl) {
    throw badRequest("302Pay checkout requires return and callback URLs", "BILLING_URL_REQUIRED");
  }

  const checkout = await createPay302Checkout({
    orderId: params.orderId,
    description: `NexusNote ${params.plan}`,
    amountCents: params.amountCents,
    redirectUrl: params.returnUrl,
    callbackUrl: params.callbackUrl,
  });

  return {
    providerOrderId: checkout.checkout_id,
    checkoutUrl: checkout.checkout_url,
    metadata: {
      checkoutId: checkout.checkout_id,
      providerStatus: checkout.status ?? null,
      providerAmount: checkout.amount ?? null,
      providerCreatedAt: checkout.created_at ?? null,
    },
  };
}

function buildExternalCheckoutUrl(params: {
  orderId: string;
  userId: string;
  plan: BillingPlanId;
  amountCents: number;
  currency: string;
  returnUrl?: string;
}): string | null {
  if (!env.BILLING_CHECKOUT_BASE_URL) {
    return null;
  }

  const url = new URL(env.BILLING_CHECKOUT_BASE_URL);
  const payload = [
    params.orderId,
    params.userId,
    params.plan,
    String(params.amountCents),
    params.currency,
  ].join(".");

  url.searchParams.set("order_id", params.orderId);
  url.searchParams.set("user_id", params.userId);
  url.searchParams.set("plan", params.plan);
  url.searchParams.set("amount_cents", String(params.amountCents));
  url.searchParams.set("currency", params.currency);

  if (params.returnUrl) {
    url.searchParams.set("return_url", params.returnUrl);
  }

  if (env.BILLING_WEBHOOK_SECRET) {
    url.searchParams.set("signature", signBillingPayload(env.BILLING_WEBHOOK_SECRET, payload));
  }

  return url.toString();
}

export function assertBillingWebhookConfigured(): void {
  if (!env.BILLING_WEBHOOK_SECRET) {
    throw badRequest("Billing webhook secret is not configured", "BILLING_NOT_CONFIGURED");
  }
}

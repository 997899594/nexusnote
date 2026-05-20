import { z } from "zod";
import { billingOrders, billingWebhookEvents, db, eq } from "@/db";
import { badRequest, handleError, notFound } from "@/lib/api";
import { getPay302CheckoutStatus, isPay302PaidStatus } from "@/lib/billing/302pay";
import { markOrderPaidAndGrantEntitlement } from "@/lib/billing/entitlements";

const Pay302CallbackSchema = z.object({
  checkout_id: z.string().trim().min(1).optional(),
  checkoutId: z.string().trim().min(1).optional(),
});

async function parseCheckoutId(request: Request): Promise<string> {
  const urlCheckoutId = new URL(request.url).searchParams.get("checkout_id");
  if (urlCheckoutId) {
    return urlCheckoutId;
  }

  const rawBody = await request.text();
  if (!rawBody) {
    throw badRequest("Missing 302Pay checkout id", "BILLING_302PAY_CHECKOUT_ID_REQUIRED");
  }

  const payload =
    request.headers.get("content-type")?.includes("application/json") ||
    rawBody.trim().startsWith("{")
      ? Pay302CallbackSchema.parse(JSON.parse(rawBody))
      : Pay302CallbackSchema.parse(Object.fromEntries(new URLSearchParams(rawBody)));
  const checkoutId = payload.checkout_id ?? payload.checkoutId;
  if (!checkoutId) {
    throw badRequest("Missing 302Pay checkout id", "BILLING_302PAY_CHECKOUT_ID_REQUIRED");
  }

  return checkoutId;
}

async function handlePay302Callback(request: Request) {
  const checkoutId = await parseCheckoutId(request);
  const status = await getPay302CheckoutStatus(checkoutId);
  const eventId = `302pay:${status.checkout_id}:${status.status}`;

  const [event] = await db
    .insert(billingWebhookEvents)
    .values({
      provider: "302pay",
      eventId,
      payload: status,
    })
    .onConflictDoNothing()
    .returning();

  if (!event) {
    return Response.json({ received: true, duplicate: true });
  }

  if (!isPay302PaidStatus(status.status)) {
    return Response.json({ received: true, paid: false, status: status.status });
  }

  const [order] = await db
    .select()
    .from(billingOrders)
    .where(eq(billingOrders.providerOrderId, status.checkout_id))
    .limit(1);

  if (!order || order.provider !== "302pay") {
    throw notFound("302Pay 订单不存在", "BILLING_302PAY_ORDER_NOT_FOUND");
  }

  await markOrderPaidAndGrantEntitlement({
    orderId: order.id,
    provider: "302pay",
    providerOrderId: status.checkout_id,
    providerTransactionId: status.checkout_id,
    paidAt: new Date(),
  });

  await db
    .update(billingWebhookEvents)
    .set({
      processedAt: new Date(),
    })
    .where(eq(billingWebhookEvents.id, event.id));

  return Response.json({ received: true, paid: true });
}

export const GET = async (request: Request) => {
  try {
    return await handlePay302Callback(request);
  } catch (error) {
    return handleError(error);
  }
};

export const POST = async (request: Request) => {
  try {
    return await handlePay302Callback(request);
  } catch (error) {
    return handleError(error);
  }
};

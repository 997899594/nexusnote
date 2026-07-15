import { z } from "zod";
import { billingOrders, db, eq } from "@/db";
import { badRequest, handleError, notFound } from "@/lib/api";
import { readBodyWithinLimit } from "@/lib/api/request-body";
import { getPay302CheckoutStatus, isPay302PaidStatus } from "@/lib/billing/302pay";
import { processPaidBillingWebhook, recordBillingWebhookEvent } from "@/lib/billing/entitlements";

const Pay302CallbackSchema = z.object({
  checkout_id: z.string().trim().min(1).optional(),
  checkoutId: z.string().trim().min(1).optional(),
});
const MAX_BILLING_WEBHOOK_BYTES = 64 * 1024;

async function parseCheckoutId(request: Request): Promise<string> {
  const urlCheckoutId = new URL(request.url).searchParams.get("checkout_id");
  if (urlCheckoutId) {
    return urlCheckoutId;
  }

  const rawBody = await readBodyWithinLimit(request, MAX_BILLING_WEBHOOK_BYTES);
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

  const event = {
    provider: "302pay",
    eventId,
    payload: status,
  };

  if (!isPay302PaidStatus(status.status)) {
    const result = await recordBillingWebhookEvent(event);
    return Response.json({
      received: true,
      duplicate: result.duplicate,
      paid: false,
      status: status.status,
    });
  }

  const [order] = await db
    .select()
    .from(billingOrders)
    .where(eq(billingOrders.providerOrderId, status.checkout_id))
    .limit(1);

  if (order?.provider !== "302pay") {
    throw notFound("302Pay 订单不存在", "BILLING_302PAY_ORDER_NOT_FOUND");
  }

  const result = await processPaidBillingWebhook({
    event: {
      provider: "302pay",
      eventId,
      payload: status,
    },
    orderId: order.id,
    providerOrderId: status.checkout_id,
    providerTransactionId: status.checkout_id,
    paidAt: new Date(),
    amountCents: status.amount == null ? undefined : Math.round(status.amount * 100),
  });

  return Response.json({ received: true, duplicate: result.duplicate, paid: true });
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

import { z } from "zod";
import { billingOrders, db, eq } from "@/db";
import { badRequest, handleError, notFound } from "@/lib/api";
import { readBodyWithinLimit } from "@/lib/api/request-body";
import { processPaidBillingWebhook, recordBillingWebhookEvent } from "@/lib/billing/entitlements";
import { isPayJSPaidStatus, verifyPayJSSignature } from "@/lib/billing/payjs";

async function parsePayJSBody(request: Request): Promise<Record<string, string>> {
  const contentType = request.headers.get("content-type") ?? "";
  const text = await readBodyWithinLimit(request, 64 * 1024);
  if (contentType.includes("application/json")) {
    return z.record(z.string(), z.string()).parse(JSON.parse(text));
  }

  return Object.fromEntries(new URLSearchParams(text));
}

export async function POST(request: Request) {
  try {
    const params = await parsePayJSBody(request);

    if (!verifyPayJSSignature(params)) {
      throw badRequest("PayJS 签名验证失败", "BILLING_PAYJS_SIGNATURE_INVALID");
    }

    const payjsOrderId = params.payjs_order_id;
    if (!payjsOrderId) {
      throw badRequest("缺少 PayJS 订单号", "BILLING_PAYJS_ORDER_ID_MISSING");
    }

    const eventId = `payjs:${payjsOrderId}:${params.return_code ?? "0"}`;

    const event = {
      provider: "payjs",
      eventId,
      payload: params as Record<string, unknown>,
    };

    if (!isPayJSPaidStatus(Number(params.return_code))) {
      await recordBillingWebhookEvent(event);
      return new Response("success", { headers: { "Content-Type": "text/plain" } });
    }

    const amountCents = z.coerce.number().int().positive().parse(params.total_fee);

    const [order] = await db
      .select()
      .from(billingOrders)
      .where(eq(billingOrders.providerOrderId, payjsOrderId))
      .limit(1);

    if (order?.provider !== "payjs") {
      throw notFound("PayJS 订单不存在", "BILLING_PAYJS_ORDER_NOT_FOUND");
    }

    await processPaidBillingWebhook({
      event: {
        provider: "payjs",
        eventId,
        payload: params as Record<string, unknown>,
      },
      orderId: order.id,
      providerOrderId: payjsOrderId,
      providerTransactionId: params.transaction_id ?? payjsOrderId,
      paidAt: new Date(),
      amountCents,
    });

    return new Response("success", { headers: { "Content-Type": "text/plain" } });
  } catch (error) {
    return handleError(error);
  }
}

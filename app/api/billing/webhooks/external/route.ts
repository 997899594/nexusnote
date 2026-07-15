import { z } from "zod";
import { env } from "@/config/env";
import { badRequest, handleError } from "@/lib/api";
import { readBodyWithinLimit } from "@/lib/api/request-body";
import { processPaidBillingWebhook } from "@/lib/billing/entitlements";
import { assertBillingWebhookConfigured } from "@/lib/billing/provider";
import { verifyBillingSignature } from "@/lib/billing/signing";

const ExternalBillingWebhookSchema = z.object({
  eventId: z.string().trim().min(1),
  orderId: z.string().uuid(),
  status: z.enum(["paid"]),
  amountCents: z.number().int().positive(),
  providerOrderId: z.string().trim().min(1).optional(),
  providerTransactionId: z.string().trim().min(1).optional(),
  paidAt: z.string().datetime().optional(),
});

export const POST = async (request: Request) => {
  try {
    assertBillingWebhookConfigured();

    const rawBody = await readBodyWithinLimit(request, 64 * 1024);
    const signature =
      request.headers.get("x-billing-signature") ??
      request.headers.get("x-signature") ??
      request.headers.get("x-nexusnote-signature") ??
      "";

    if (
      !verifyBillingSignature({
        secret: env.BILLING_WEBHOOK_SECRET,
        payload: rawBody,
        signature,
      })
    ) {
      throw badRequest("Invalid billing webhook signature", "BILLING_SIGNATURE_INVALID");
    }

    const payload = ExternalBillingWebhookSchema.parse(JSON.parse(rawBody));
    const result = await processPaidBillingWebhook({
      event: {
        provider: "external",
        eventId: payload.eventId,
        signature,
        payload,
      },
      orderId: payload.orderId,
      amountCents: payload.amountCents,
      providerOrderId: payload.providerOrderId ?? null,
      providerTransactionId: payload.providerTransactionId ?? null,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
    });

    return Response.json({ received: true, duplicate: result.duplicate });
  } catch (error) {
    return handleError(error);
  }
};

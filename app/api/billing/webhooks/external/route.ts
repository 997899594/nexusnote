import { z } from "zod";
import { env } from "@/config/env";
import { billingWebhookEvents, db, eq } from "@/db";
import { badRequest, handleError } from "@/lib/api";
import { markOrderPaidAndGrantEntitlement } from "@/lib/billing/entitlements";
import { assertBillingWebhookConfigured } from "@/lib/billing/provider";
import { verifyBillingSignature } from "@/lib/billing/signing";

const ExternalBillingWebhookSchema = z.object({
  eventId: z.string().trim().min(1),
  orderId: z.string().uuid(),
  status: z.enum(["paid"]),
  amountCents: z.number().int().positive().optional(),
  providerOrderId: z.string().trim().min(1).optional(),
  providerTransactionId: z.string().trim().min(1).optional(),
  paidAt: z.string().datetime().optional(),
});

export const POST = async (request: Request) => {
  try {
    assertBillingWebhookConfigured();

    const rawBody = await request.text();
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
    const [event] = await db
      .insert(billingWebhookEvents)
      .values({
        provider: "external",
        eventId: payload.eventId,
        signature,
        payload,
      })
      .onConflictDoNothing()
      .returning();

    if (!event) {
      return Response.json({ received: true, duplicate: true });
    }

    await markOrderPaidAndGrantEntitlement({
      orderId: payload.orderId,
      provider: "external",
      amountCents: payload.amountCents,
      providerOrderId: payload.providerOrderId ?? null,
      providerTransactionId: payload.providerTransactionId ?? null,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : undefined,
    });

    await db
      .update(billingWebhookEvents)
      .set({
        processedAt: new Date(),
      })
      .where(eq(billingWebhookEvents.id, event.id));

    return Response.json({ received: true });
  } catch (error) {
    return handleError(error);
  }
};

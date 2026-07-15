import { z } from "zod";
import { env } from "@/config/env";
import { badRequest, parseJsonBodyAs, withAuth } from "@/lib/api";
import { createBillingCheckout } from "@/lib/billing/provider";

const CheckoutRequestSchema = z.object({
  plan: z.enum(["pro_month", "pro_year"]),
  returnUrl: z.string().url().optional(),
});

export const POST = withAuth(async (request, { userId }) => {
  const input = await parseJsonBodyAs(request, CheckoutRequestSchema);
  const origin = new URL(env.APP_BASE_URL ?? request.url).origin;
  const returnUrl = new URL(input.returnUrl ?? "/profile/settings", origin);
  if (returnUrl.origin !== origin) {
    throw badRequest("支付完成页必须属于当前应用", "BILLING_RETURN_URL_ORIGIN_INVALID");
  }
  const webhookProvider = env.BILLING_PROVIDER === "payjs" ? "payjs" : "302pay";
  const checkout = await createBillingCheckout({
    userId,
    plan: input.plan,
    returnUrl: returnUrl.toString(),
    callbackUrl: `${origin}/api/billing/webhooks/${webhookProvider}`,
  });

  return Response.json(checkout, { status: 201 });
});

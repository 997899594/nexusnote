import { z } from "zod";
import { parseJsonBodyAs, withAuth } from "@/lib/api";
import { createBillingCheckout } from "@/lib/billing/provider";

const CheckoutRequestSchema = z.object({
  plan: z.enum(["pro_month", "pro_year"]),
  returnUrl: z.string().url().optional(),
});

export const POST = withAuth(async (request, { userId }) => {
  const input = await parseJsonBodyAs(request, CheckoutRequestSchema);
  const origin = new URL(request.url).origin;
  const checkout = await createBillingCheckout({
    userId,
    plan: input.plan,
    returnUrl: input.returnUrl ?? `${origin}/profile/settings`,
    callbackUrl: `${origin}/api/billing/webhooks/302pay`,
  });

  return Response.json(checkout, { status: 201 });
});

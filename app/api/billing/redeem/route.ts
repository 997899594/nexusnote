import { z } from "zod";
import { parseJsonBodyAs, withAuth } from "@/lib/api";
import { redeemCodeForUser } from "@/lib/billing/entitlements";

const RedeemRequestSchema = z.object({
  code: z.string().trim().min(4).max(80),
});

export const POST = withAuth(async (request, { userId }) => {
  const { code } = await parseJsonBodyAs(request, RedeemRequestSchema);
  const entitlement = await redeemCodeForUser({ userId, code });

  return Response.json({
    success: true,
    entitlement: {
      id: entitlement.id,
      plan: entitlement.plan,
      expiresAt: entitlement.expiresAt,
    },
  });
});

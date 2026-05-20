import { withAuth } from "@/lib/api";
import { getActiveEntitlement } from "@/lib/billing/entitlements";
import { BILLING_PLANS } from "@/lib/billing/plans";

export const GET = withAuth(async (_request, { userId }) => {
  const entitlement = await getActiveEntitlement(userId);

  return Response.json({
    plan: entitlement?.plan ?? "free",
    entitlement: entitlement
      ? {
          id: entitlement.id,
          plan: entitlement.plan,
          source: entitlement.source,
          startsAt: entitlement.startsAt,
          expiresAt: entitlement.expiresAt,
        }
      : null,
    plans: Object.values(BILLING_PLANS),
  });
});

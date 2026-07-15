import { withAuth } from "@/lib/api";
import { getActiveProductAccessGrant } from "@/lib/billing/capability-access";
import { getActiveEntitlement } from "@/lib/billing/entitlements";
import { BILLING_PLANS } from "@/lib/billing/plans";

export const GET = withAuth(async (_request, { userId }) => {
  const [entitlement, grant] = await Promise.all([
    getActiveEntitlement(userId),
    getActiveProductAccessGrant(userId),
  ]);

  return Response.json({
    plan: grant?.plan ?? entitlement?.plan ?? "free",
    entitlement: grant
      ? {
          id: grant.id,
          plan: grant.plan,
          source: grant.source,
          startsAt: grant.startsAt,
          expiresAt: grant.expiresAt,
        }
      : entitlement
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

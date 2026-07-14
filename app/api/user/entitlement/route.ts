import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api";
import { getUserEntitlementStatus } from "@/lib/billing/entitlements";

export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  const status = await getUserEntitlementStatus(userId);

  return Response.json(status);
});

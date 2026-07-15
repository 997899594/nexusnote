import type { NextRequest } from "next/server";
import { withAuth } from "@/lib/api";
import { AI_CAPABILITIES } from "@/lib/billing/capabilities";
import { getCapabilityAllowance } from "@/lib/billing/capability-access";
import { getUserEntitlementStatus } from "@/lib/billing/entitlements";

export const GET = withAuth(async (_request: NextRequest, { userId }) => {
  const [status, researchAllowance, courseGenerationAllowance] = await Promise.all([
    getUserEntitlementStatus(userId),
    getCapabilityAllowance(userId, AI_CAPABILITIES.research),
    getCapabilityAllowance(userId, AI_CAPABILITIES.courseGeneration),
  ]);

  return Response.json({ ...status, researchAllowance, courseGenerationAllowance });
});

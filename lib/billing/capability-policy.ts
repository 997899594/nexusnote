import { paymentRequired } from "@/lib/api/errors";
import { AI_CAPABILITIES, type AICapability, requiresEntitlement } from "./capabilities";
import { getActiveEntitlement } from "./entitlements";

export { AI_CAPABILITIES, type AICapability } from "./capabilities";

export async function canUseAICapability(userId: string, capability: AICapability) {
  if (!requiresEntitlement(capability)) {
    return true;
  }

  return Boolean(await getActiveEntitlement(userId));
}

export function assertAICapabilityAccess(capability: AICapability, allowed: boolean): void {
  if (allowed) {
    return;
  }

  throw paymentRequired(
    capability === AI_CAPABILITIES.research
      ? "联网研究需要有效试用或 Pro 权益"
      : "课程生成需要有效试用或 Pro 权益",
    "ENTITLEMENT_REQUIRED",
  );
}

export async function requireAICapability(userId: string, capability: AICapability): Promise<void> {
  assertAICapabilityAccess(capability, await canUseAICapability(userId, capability));
}

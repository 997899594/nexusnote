import type { AICapability } from "./capabilities";
import { getCapabilityAllowance } from "./capability-access";
import { CapabilityAllowanceExceededError } from "./capability-errors";

export { AI_CAPABILITIES, type AICapability } from "./capabilities";

export async function canUseAICapability(userId: string, capability: AICapability) {
  return (await getCapabilityAllowance(userId, capability)).allowed;
}

export function assertAICapabilityAccess(capability: AICapability, allowed: boolean): void {
  if (allowed) {
    return;
  }

  throw new CapabilityAllowanceExceededError(capability);
}

export async function requireAICapability(userId: string, capability: AICapability): Promise<void> {
  assertAICapabilityAccess(capability, await canUseAICapability(userId, capability));
}

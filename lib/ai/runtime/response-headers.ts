import {
  CAPABILITY_MODE_VALUES,
  type CapabilityMode,
  EXECUTION_MODE_VALUES,
  type ExecutionMode,
} from "./contracts";

export const AI_EXECUTION_MODE_HEADER = "X-AI-Execution-Mode";
export const AI_HANDOFF_TARGET_HEADER = "X-AI-Handoff-Target";

export interface AIRouteResponseHint {
  executionMode: ExecutionMode;
  handoffTarget: CapabilityMode | null;
}

function isExecutionMode(value: string | null): value is ExecutionMode {
  return value != null && EXECUTION_MODE_VALUES.includes(value as ExecutionMode);
}

function isCapabilityMode(value: string | null): value is CapabilityMode {
  return value != null && CAPABILITY_MODE_VALUES.includes(value as CapabilityMode);
}

export function parseAIRouteResponseHint(
  headers: Pick<Headers, "get">,
): AIRouteResponseHint | null {
  const executionMode = headers.get(AI_EXECUTION_MODE_HEADER);

  if (!isExecutionMode(executionMode)) {
    return null;
  }

  const handoffTargetHeader = headers.get(AI_HANDOFF_TARGET_HEADER);

  return {
    executionMode,
    handoffTarget: isCapabilityMode(handoffTargetHeader) ? handoffTargetHeader : null,
  };
}

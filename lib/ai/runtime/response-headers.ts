import {
  CAPABILITY_MODE_VALUES,
  type CapabilityMode,
  EXECUTION_MODE_VALUES,
  type ExecutionMode,
} from "./contracts";

export const AI_EXECUTION_MODE_HEADER = "X-AI-Execution-Mode";
export const AI_HANDOFF_TARGET_HEADER = "X-AI-Handoff-Target";
export const AI_WORKFLOW_JOB_ID_HEADER = "X-AI-Workflow-Job-Id";
export const AI_WORKFLOW_JOB_TYPE_HEADER = "X-AI-Workflow-Job-Type";

export interface AIRouteResponseHint {
  executionMode: ExecutionMode;
  handoffTarget: CapabilityMode | null;
  workflowJobId: string | null;
  workflowJobType: string | null;
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
  const workflowJobId = headers.get(AI_WORKFLOW_JOB_ID_HEADER);
  const workflowJobType = headers.get(AI_WORKFLOW_JOB_TYPE_HEADER);

  return {
    executionMode,
    handoffTarget: isCapabilityMode(handoffTargetHeader) ? handoffTargetHeader : null,
    workflowJobId: workflowJobId && workflowJobId.length > 0 ? workflowJobId : null,
    workflowJobType: workflowJobType && workflowJobType.length > 0 ? workflowJobType : null,
  };
}

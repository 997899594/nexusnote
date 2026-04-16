import type { InterviewOutline, InterviewState, InterviewSufficiency } from "./schemas";

type MissingCoreField = InterviewSufficiency["missingCoreFields"][number];
type NextFocus = InterviewSufficiency["nextFocus"];

function hasContent(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length >= 2;
}

function hasConstraints(state: InterviewState) {
  return state.constraints.length > 0;
}

function resolveNextFocus(state: InterviewState, missingCoreFields: MissingCoreField[]): NextFocus {
  if (state.phase === "revise") {
    return "revision";
  }

  if (missingCoreFields.length > 0) {
    return missingCoreFields[0];
  }

  if (!hasConstraints(state)) {
    return "constraints";
  }

  return "currentBaseline";
}

export function evaluateInterviewSufficiency(
  state: InterviewState,
  currentOutline?: InterviewOutline,
): InterviewSufficiency {
  if (state.phase === "revise" && currentOutline) {
    const reviseAllowed = hasContent(state.revisionIntent) || state.confidence >= 0.45;

    return {
      allowOutline: reviseAllowed,
      missingCoreFields: [],
      nextFocus: reviseAllowed ? "revision" : "revision",
      reason: reviseAllowed
        ? "用户已经给出可执行的修改方向，可以直接返回更新版课程草案。"
        : "当前仍然是大纲修改语境，但修改点还不够具体，需要先澄清一轮。",
    };
  }

  const missingCoreFields: MissingCoreField[] = [];
  const hasTopic = hasContent(state.topic);
  const hasTargetOutcome = hasContent(state.targetOutcome);
  const hasBaseline = hasContent(state.currentBaseline);
  const hasKeyConstraints = hasConstraints(state);

  if (!hasTopic) {
    missingCoreFields.push("topic");
  }

  if (!hasTargetOutcome) {
    missingCoreFields.push("targetOutcome");
  }

  if (!hasBaseline && !hasKeyConstraints) {
    missingCoreFields.push("currentBaseline");
  }

  const allowOutline =
    hasTopic && hasTargetOutcome && (hasBaseline || hasKeyConstraints) && state.confidence >= 0.58;
  const nextFocus = resolveNextFocus(state, missingCoreFields);

  return {
    allowOutline,
    missingCoreFields,
    nextFocus,
    reason: allowOutline
      ? "主题、目标结果，以及基础或关键约束已经足够，可以生成课程草案。"
      : missingCoreFields.length > 0
        ? `还缺少关键课程设计信息：${missingCoreFields.join("、")}。`
        : "主题和目标已经清楚，但还需要补一个关键限制条件再生成更稳。",
  };
}

import type { InterviewOutline, InterviewState, InterviewSufficiency } from "./schemas";

type NextFocus = InterviewSufficiency["nextFocus"];

function hasContent(value: string | null | undefined) {
  return typeof value === "string" && value.trim().length >= 2;
}

function inferUseCaseFromGoal(goal: string | null) {
  if (!goal) {
    return false;
  }

  const normalized = goal.toLowerCase();
  return [
    "项目",
    "工作",
    "作品集",
    "面试",
    "考研",
    "考试",
    "转岗",
    "求职",
    "分析",
    "可视化",
    "网站",
    "应用",
  ].some((keyword) => normalized.includes(keyword));
}

function resolveNextFocus(
  state: InterviewState,
  missingCoreFields: Array<"goal" | "background" | "useCase">,
): NextFocus {
  if (state.mode === "revise") {
    return "revise";
  }

  if (missingCoreFields.length > 0) {
    return missingCoreFields[0];
  }

  if (!hasContent(state.constraints.timeBudget) || !hasContent(state.constraints.preferredDepth)) {
    return "constraints";
  }

  if (!hasContent(state.preferences.style) || state.preferences.focusAreas.length === 0) {
    return "preferences";
  }

  return "revise";
}

export function evaluateInterviewSufficiency(
  state: InterviewState,
  currentOutline?: InterviewOutline,
): InterviewSufficiency {
  const missingCoreFields: Array<"goal" | "background" | "useCase"> = [];

  if (!hasContent(state.goal)) {
    missingCoreFields.push("goal");
  }

  if (!hasContent(state.background)) {
    missingCoreFields.push("background");
  }

  if (!hasContent(state.useCase) && !inferUseCaseFromGoal(state.goal)) {
    missingCoreFields.push("useCase");
  }

  if (state.mode === "revise" && currentOutline) {
    const reviseAllowed =
      state.openQuestions.length <= 2 || state.confidence >= 0.55 || hasContent(state.goal);

    return {
      allowOutline: reviseAllowed,
      missingCoreFields: reviseAllowed ? [] : missingCoreFields,
      nextFocus: reviseAllowed ? "revise" : resolveNextFocus(state, missingCoreFields),
      reason: reviseAllowed
        ? "用户已经在现有大纲上提出修改，可以直接返回更新版。"
        : "当前修改意图仍不够具体，需要先澄清关键调整方向。",
    };
  }

  const allowOutline = missingCoreFields.length === 0 && state.confidence >= 0.7;

  return {
    allowOutline,
    missingCoreFields,
    nextFocus: allowOutline ? "revise" : resolveNextFocus(state, missingCoreFields),
    reason: allowOutline
      ? "核心信息已经足够，可以生成课程草案。"
      : missingCoreFields.length > 0
        ? `仍缺少关键访谈信息：${missingCoreFields.join("、")}。`
        : "核心方向已明确，但还需要再补一个关键约束后再生成更稳。",
  };
}

import type {
  CapabilityMode,
  ConversationCapabilityMode,
  IntentClassification,
  RouteDecision,
  RoutingIntent,
  Surface,
} from "@/lib/ai/runtime/contracts";
import type { ResolvedRequestContext } from "@/lib/ai/runtime/resolve-request-context";

function getSurfaceFallbackMode(
  surface: Surface,
  hasLearningGuidance: boolean,
  hasCareerTreeSnapshot: boolean,
): ConversationCapabilityMode {
  switch (surface) {
    case "learn":
      return hasLearningGuidance ? "learn_coach" : "general_chat";
    case "notes":
      return "note_assistant";
    case "career":
      return hasCareerTreeSnapshot ? "career_guide" : "general_chat";
    default:
      return "general_chat";
  }
}

function isConversationCapabilityMode(value: CapabilityMode): value is ConversationCapabilityMode {
  return (
    value === "general_chat" ||
    value === "learn_coach" ||
    value === "note_assistant" ||
    value === "research_assistant" ||
    value === "career_guide"
  );
}

function mapCapabilityToIntent(capabilityMode: CapabilityMode): RoutingIntent {
  switch (capabilityMode) {
    case "learn_coach":
      return "learn_explanation";
    case "note_assistant":
      return "note_work";
    case "research_assistant":
      return "research_lookup";
    case "career_guide":
      return "career_guidance";
    case "course_interviewer":
      return "course_interview";
    default:
      return "general_assistance";
  }
}

export function arbitrateRoute(params: {
  requestContext: ResolvedRequestContext;
  classification: IntentClassification;
}): RouteDecision {
  const { requestContext, classification } = params;
  const arbiterNotes = [...classification.reasons];
  let resolvedCapabilityMode = isConversationCapabilityMode(classification.capabilityMode)
    ? classification.capabilityMode
    : getSurfaceFallbackMode(
        requestContext.surface,
        requestContext.hasLearningGuidance,
        requestContext.hasCareerTreeSnapshot,
      );
  let executionMode = classification.executionMode;
  let handoffTarget: CapabilityMode | null = null;
  let assistantInstruction: string | null = null;

  if (requestContext.surface === "interview") {
    resolvedCapabilityMode = "general_chat";
    executionMode = "redirect";
    handoffTarget = "course_interviewer";
    arbiterNotes.push("interview surface is reserved for the dedicated course_interviewer flow");
    assistantInstruction =
      "你当前所在的是课程访谈入口。请直接引导用户进入 /interview 的访谈流程，而不是在普通聊天里继续展开。";
  }

  if (classification.capabilityMode === "course_interviewer") {
    resolvedCapabilityMode = "general_chat";
    executionMode = "redirect";
    handoffTarget = "course_interviewer";
    arbiterNotes.push("course_interviewer uses the dedicated /interview flow, not /api/chat");
    assistantInstruction =
      "本轮请求本质上更适合课程访谈/目标澄清流。请直接告诉用户改去 /interview 开始访谈，并用一句话解释为什么这个流更合适。不要假装已经进入访谈模式。";
  }

  if (classification.capabilityMode === "learn_coach" && !requestContext.hasLearningGuidance) {
    resolvedCapabilityMode = "general_chat";
    executionMode = "ask_clarification";
    handoffTarget = "learn_coach";
    arbiterNotes.push("learn_coach requires live course context");
    assistantInstruction =
      "用户的问题更像学习答疑，但当前没有课程上下文。请先请用户打开对应课程/章节，或告诉你具体在学哪门课，再继续深入解释。";
  }

  if (classification.capabilityMode === "career_guide" && !requestContext.hasCareerTreeSnapshot) {
    resolvedCapabilityMode = "general_chat";
    executionMode = "ask_clarification";
    handoffTarget = "career_guide";
    arbiterNotes.push("career_guide requires an existing career tree snapshot");
    assistantInstruction =
      "用户在问职业方向或下一步学习，但当前还没有可用的职业树快照。请明确告诉用户：先保存并学习几门课程，系统生成职业树后才能给出更具体的个性化方向建议。";
  }

  if (
    classification.executionMode === "workflow" &&
    classification.capabilityMode === "research_assistant"
  ) {
    resolvedCapabilityMode = "general_chat";
    executionMode = "workflow";
    handoffTarget = "research_assistant";
    arbiterNotes.push("deep research requests are executed as background workflows");
    assistantInstruction =
      "这个请求会通过后台研究工作流完成。先确认已入队，再在研究完成后把结果返回给用户。不要把它当成普通对话里一次性回答。";
  }

  if (classification.executionMode === "workflow") {
    if (handoffTarget !== "research_assistant") {
      resolvedCapabilityMode = "general_chat";
      executionMode = "redirect";
      handoffTarget = handoffTarget ?? classification.capabilityMode;
      arbiterNotes.push("workflow requests are not executed directly inside the chat specialist");
      assistantInstruction =
        assistantInstruction ??
        "这个请求更适合进入专门的页面或后台工作流，而不是在普通聊天里直接执行。请说明边界，并把用户引导到更合适的入口。";
    }
  }

  if (resolvedCapabilityMode !== "general_chat" && executionMode === "direct_answer") {
    executionMode = "tool_loop";
    arbiterNotes.push("specialist capabilities default to tool_loop on the chat runtime");
  }

  return {
    ...classification,
    intent: mapCapabilityToIntent(handoffTarget ?? classification.capabilityMode),
    executionMode,
    resolvedCapabilityMode,
    handoffTarget,
    arbiterNotes,
    assistantInstruction,
  };
}

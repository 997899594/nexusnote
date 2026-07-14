import {
  type PrepareStepFunction,
  type StopCondition,
  stepCountIs,
  ToolLoopAgent,
  type ToolSet,
} from "ai";
import {
  formatLearningGuidancePromptContext,
  getLearningGuidance,
  type LearningGuidance,
} from "@/lib/learning/guidance";
import {
  isCareerRequestMetadata,
  isLearnRequestMetadata,
  type RequestMetadata,
} from "@/types/request-metadata";
import {
  getModelForPolicy,
  getToolCallingModelForPolicy,
  type ModelPolicy,
} from "../core/model-policy";
import type { AIModelSeries } from "../core/model-series";
import { buildPromptInstructions, type PromptKey } from "../core/prompt-registry";
import { type AITelemetryContext, recordAIUsage } from "../core/telemetry";
import type { ConversationCapabilityMode } from "../runtime/contracts";
import { buildToolsForCapabilityMode } from "../tools";

const CAREER_PLANNING_BOOTSTRAP_TEXT = "__career_planning_mentor_bootstrap__";
const PRESENT_CAREER_GRAPH_PATCH_TOOL = "presentCareerGraphPatch";
const WEB_SEARCH_TOOL = "webSearch";

interface CareerPlanningRuntimeContext {
  promptContext: string;
}

async function buildCareerPlanningRuntimeContextForSpecialist(
  userId: string,
): Promise<CareerPlanningRuntimeContext> {
  const { buildCareerPlanningSpecialistContext } = await import(
    "@/lib/career-planning/workspace-data"
  );

  return buildCareerPlanningSpecialistContext(userId);
}

function getMessageText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }

  const content = "content" in message ? message.content : null;

  if (typeof content === "string") {
    return content;
  }

  if (!Array.isArray(content)) {
    return "";
  }

  return content
    .map((part) => {
      if (!part || typeof part !== "object" || !("text" in part)) {
        return "";
      }

      return typeof part.text === "string" ? part.text : "";
    })
    .join("")
    .trim();
}

function isCareerPlanningBootstrapMessage(message: unknown): boolean {
  return getMessageText(message) === CAREER_PLANNING_BOOTSTRAP_TEXT;
}

function hasStepToolCall(step: unknown, toolName: string): boolean {
  if (!step || typeof step !== "object" || !("toolCalls" in step)) {
    return false;
  }

  const toolCalls = step.toolCalls;
  if (!Array.isArray(toolCalls)) {
    return false;
  }

  return toolCalls.some(
    (toolCall) =>
      toolCall &&
      typeof toolCall === "object" &&
      "toolName" in toolCall &&
      toolCall.toolName === toolName,
  );
}

function hasStepToolResult(step: unknown, toolName: string): boolean {
  if (!step || typeof step !== "object" || !("toolResults" in step)) {
    return false;
  }

  const toolResults = step.toolResults;
  if (!Array.isArray(toolResults)) {
    return false;
  }

  return toolResults.some(
    (toolResult) =>
      toolResult &&
      typeof toolResult === "object" &&
      "toolName" in toolResult &&
      toolResult.toolName === toolName &&
      "type" in toolResult &&
      toolResult.type === "tool-result",
  );
}

function createCareerPlanningPrepareStep(researchEnabled: boolean): PrepareStepFunction<ToolSet> {
  return ({ messages, stepNumber, steps }) => {
    const isBootstrap = messages.some(isCareerPlanningBootstrapMessage);
    const hasSearched = steps.some((step) => hasStepToolCall(step, WEB_SEARCH_TOOL));

    if (researchEnabled && stepNumber === 0 && isBootstrap && !hasSearched) {
      return {
        toolChoice: {
          type: "tool",
          toolName: WEB_SEARCH_TOOL,
        },
      };
    }

    if (!steps.some((step) => hasStepToolResult(step, PRESENT_CAREER_GRAPH_PATCH_TOOL))) {
      return {
        toolChoice: {
          type: "tool",
          toolName: PRESENT_CAREER_GRAPH_PATCH_TOOL,
        },
      };
    }

    return undefined;
  };
}

function createCareerPlanningStopWhen(maxSteps: number): Array<StopCondition<ToolSet>> {
  return [
    stepCountIs(maxSteps),
    ({ steps }) => steps.some((step) => hasStepToolResult(step, PRESENT_CAREER_GRAPH_PATCH_TOOL)),
  ];
}

export interface ConversationSpecialistRuntimeSpec {
  mode: ConversationCapabilityMode;
  authRequired: boolean;
  resourceRequired: boolean;
  modelPolicy: ModelPolicy;
  promptKey: PromptKey;
  promptVersion: string;
  maxSteps: number;
  preferToolCallingModel: boolean;
}

export interface ConversationSpecialistAgentOptions {
  behaviorPrompt?: string;
  skinPrompt?: string;
  userContext?: string;
  userId?: string;
  courseId?: string;
  learningGuidance?: LearningGuidance | null;
  metadata?: RequestMetadata;
  modelSeries?: AIModelSeries;
  telemetry?: AITelemetryContext;
  researchEnabled?: boolean;
}

export async function createConversationToolLoopSpecialist(
  spec: ConversationSpecialistRuntimeSpec,
  options: ConversationSpecialistAgentOptions = {},
) {
  const startedAt = Date.now();

  if (spec.authRequired && !options.userId) {
    throw new Error(`${spec.mode} requires authenticated user`);
  }
  if (spec.resourceRequired && !options.courseId) {
    throw new Error(`${spec.mode} requires resourceId`);
  }

  const userContextParts = options.userContext ? [options.userContext] : [];
  let isCareerPlanningRequest = false;

  if (spec.mode === "learn_coach" && options.courseId && isLearnRequestMetadata(options.metadata)) {
    const learningGuidance =
      options.learningGuidance ??
      (options.userId
        ? await getLearningGuidance({
            userId: options.userId,
            courseId: options.courseId,
            chapterIndex: options.metadata.chapterIndex,
          })
        : null);

    if (!learningGuidance) {
      throw new Error("learn_coach requires learning guidance");
    }

    userContextParts.push(
      formatLearningGuidancePromptContext(learningGuidance, {
        sectionIndex: options.metadata.sectionIndex,
      }),
    );
  }

  if (spec.mode === "career_guide" && isCareerRequestMetadata(options.metadata)) {
    if (options.metadata.entry === "planning" && options.userId) {
      const runtimeContext = await buildCareerPlanningRuntimeContextForSpecialist(options.userId);
      userContextParts.push(runtimeContext.promptContext);
      isCareerPlanningRequest = true;
    }

    const selectedDirectionKey = options.metadata.selectedDirectionKey?.trim();

    if (selectedDirectionKey) {
      userContextParts.push(
        [
          "## 当前职业方向锚点",
          `本轮用户正在查看的目标方向 key: ${selectedDirectionKey}`,
          "如果你调用 loadCareerContext，请优先传入这个 directionKey，而不是默认读取别的方向。",
        ].join("\n"),
      );
    }
  }

  const instructions = buildPromptInstructions(spec.promptKey, {
    behaviorPrompt: options.behaviorPrompt,
    skinPrompt: options.skinPrompt,
    userContext: userContextParts.length > 0 ? userContextParts.join("\n\n") : undefined,
  });
  const tools = buildToolsForCapabilityMode(spec.mode, {
    userId: options.userId,
    resourceId: options.courseId,
    researchEnabled: options.researchEnabled,
  });
  const model = spec.preferToolCallingModel
    ? getToolCallingModelForPolicy(spec.modelPolicy, {
        modelSeries: options.modelSeries,
      })
    : getModelForPolicy(spec.modelPolicy, { modelSeries: options.modelSeries });
  return new ToolLoopAgent({
    id: `nexusnote-${spec.mode}`,
    model,
    instructions,
    tools,
    prepareStep: isCareerPlanningRequest
      ? createCareerPlanningPrepareStep(options.researchEnabled === true)
      : undefined,
    stopWhen: isCareerPlanningRequest
      ? createCareerPlanningStopWhen(spec.maxSteps)
      : stepCountIs(spec.maxSteps),
    onFinish: ({ totalUsage, steps, finishReason }) => {
      if (!options.telemetry) {
        return;
      }

      const toolNames = Array.from(
        new Set(
          steps.flatMap((step) =>
            (step.toolCalls ?? []).map((toolCall) => String(toolCall.toolName)),
          ),
        ),
      );

      void recordAIUsage({
        ...options.telemetry,
        capabilityMode: spec.mode,
        usage: totalUsage,
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...options.telemetry.metadata,
          finishReason,
          stepCount: steps.length,
          toolNames,
        },
      });
    },
  });
}

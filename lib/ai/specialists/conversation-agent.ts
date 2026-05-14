import { stepCountIs, ToolLoopAgent } from "ai";
import {
  formatGrowthGenerationContext,
  type GrowthGenerationContext,
} from "@/lib/growth/generation-context-format";
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
import { buildPromptInstructions, type PromptKey } from "../core/prompt-registry";
import type { AIRouteProfile } from "../core/route-profiles";
import { type AITelemetryContext, recordAIUsage } from "../core/telemetry";
import type { ConversationCapabilityMode } from "../runtime/contracts";
import { buildToolsForCapabilityMode } from "../tools";

export interface ConversationSpecialistRuntimeSpec {
  mode: ConversationCapabilityMode;
  authRequired: boolean;
  resourceRequired: boolean;
  modelPolicy: ModelPolicy;
  promptKey: PromptKey;
  promptVersion: string;
  maxSteps: number;
  preferToolCallingModel: boolean;
  growthContextStyle: "none" | "compact" | "detailed";
}

export interface ConversationSpecialistAgentOptions {
  behaviorPrompt?: string;
  skinPrompt?: string;
  userContext?: string;
  userId?: string;
  courseId?: string;
  generationContext?: GrowthGenerationContext;
  learningGuidance?: LearningGuidance | null;
  metadata?: RequestMetadata;
  routeProfile?: AIRouteProfile;
  telemetry?: AITelemetryContext;
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

  if (options.generationContext && spec.growthContextStyle !== "none") {
    userContextParts.push(
      [
        "## 当前成长上下文",
        formatGrowthGenerationContext(options.generationContext, {
          style: spec.growthContextStyle,
        }),
      ].join("\n"),
    );
  }

  if (spec.mode === "career_guide" && isCareerRequestMetadata(options.metadata)) {
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
  });
  const model = spec.preferToolCallingModel
    ? getToolCallingModelForPolicy(spec.modelPolicy, {
        routeProfile: options.routeProfile,
      })
    : getModelForPolicy(spec.modelPolicy, { routeProfile: options.routeProfile });

  return new ToolLoopAgent({
    id: `nexusnote-${spec.mode}`,
    model,
    instructions,
    tools,
    stopWhen: stepCountIs(spec.maxSteps),
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

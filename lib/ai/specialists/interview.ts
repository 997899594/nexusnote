import { stepCountIs, ToolLoopAgent, type UIMessage } from "ai";
import { getToolCallingModelForPolicy, type ModelPolicy } from "@/lib/ai/core/model-policy";
import type { AIRouteProfile } from "@/lib/ai/core/route-profiles";
import { type AITelemetryContext, recordAIUsage } from "@/lib/ai/core/telemetry";
import { createToolContext } from "@/lib/ai/core/tool-context";
import { buildInterviewAgentInstructionsWithHint } from "@/lib/ai/interview/prompts";
import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import type { InterviewTimingSink } from "@/lib/ai/interview/timing";
import { createInterviewTools } from "@/lib/ai/tools/interview";

const COURSE_INTERVIEWER_MAX_STEPS = 12;

export interface CourseInterviewerSpecialistSpec {
  mode: "course_interviewer";
  kind: "workflow";
  authRequired: true;
  resourceRequired: false;
  modelPolicy: ModelPolicy;
  promptVersion: "interview@agent-v1";
  maxSteps: number;
}

export interface CourseInterviewerSpecialistOptions {
  userId: string;
  courseId?: string;
  currentOutline?: InterviewOutline;
  messages?: UIMessage[];
  routeProfile?: AIRouteProfile;
  telemetry?: AITelemetryContext;
  timing?: InterviewTimingSink;
}

export const courseInterviewerSpecialistSpec: CourseInterviewerSpecialistSpec = {
  mode: "course_interviewer",
  kind: "workflow",
  authRequired: true,
  resourceRequired: false,
  modelPolicy: "outline-architect",
  promptVersion: "interview@agent-v1",
  maxSteps: COURSE_INTERVIEWER_MAX_STEPS,
};

export function createCourseInterviewerSpecialist(options: CourseInterviewerSpecialistOptions) {
  const startedAt = Date.now();
  options.timing?.mark("agent.create.start", { mode: "natural" });
  options.timing?.mark("natural.model-policy.resolved", {
    hasCurrentOutline: Boolean(options.currentOutline),
  });

  const tools = createInterviewTools(
    createToolContext({
      userId: options.userId,
      resourceId: options.courseId,
      messages: options.messages,
    }),
  );
  options.timing?.mark("agent.tools.ready", { mode: "natural" });

  const agent = new ToolLoopAgent({
    id: "nexusnote-interview",
    model: getToolCallingModelForPolicy(courseInterviewerSpecialistSpec.modelPolicy, {
      routeProfile: options.routeProfile,
    }),
    instructions: buildInterviewAgentInstructionsWithHint({
      currentOutline: options.currentOutline,
      messages: options.messages,
    }),
    tools,
    stopWhen: [
      stepCountIs(COURSE_INTERVIEWER_MAX_STEPS),
      ({ steps }) =>
        steps[steps.length - 1]?.toolCalls?.some(
          (toolCall) =>
            toolCall.toolName === "presentOptions" || toolCall.toolName === "presentOutlinePreview",
        ) ?? false,
    ],
    onFinish: async ({ totalUsage, steps, finishReason }) => {
      options.timing?.mark("agent.finish", {
        mode: "natural",
        finishReason,
        stepCount: steps.length,
      });
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
        capabilityMode: "course_interviewer",
        modelPolicy: courseInterviewerSpecialistSpec.modelPolicy,
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
  options.timing?.mark("agent.create.end", { mode: "natural" });

  return agent;
}

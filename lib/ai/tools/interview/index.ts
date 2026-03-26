import { tool, type UIMessage } from "ai";
import type { ToolContext } from "@/lib/ai/core/tool-context";
import {
  evaluateInterviewSufficiency,
  extractInterviewState,
  type InterviewOutline,
  InterviewOutlineSchema,
  type InterviewSufficiency,
  validateOutlineForState,
} from "@/lib/ai/interview";
import { runCreateCourseWorkflow } from "@/lib/ai/workflows";

export const ConfirmOutlineSchema = InterviewOutlineSchema;

export interface ConfirmOutlineOutput {
  success: boolean;
  courseId?: string;
  outline?: InterviewOutline;
  reason?: string;
  nextFocus?: InterviewSufficiency["nextFocus"];
}

interface CreateInterviewToolsOptions {
  currentOutline?: InterviewOutline;
}

function toInterviewMessages(messages: UIMessage[] | undefined) {
  if (!messages) {
    return [];
  }

  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      text: message.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("")
        .trim(),
    }))
    .filter((message) => message.text.length > 0);
}

export const createInterviewTools = (
  ctx: ToolContext,
  options: CreateInterviewToolsOptions = {},
) => {
  return {
    confirmOutline: tool({
      description:
        "当课程方向已经足够明确时，生成或更新完整课程大纲。若用户在已有大纲基础上提出修改，也再次调用。",
      inputSchema: ConfirmOutlineSchema,
      execute: async (outline): Promise<ConfirmOutlineOutput> => {
        try {
          const interviewMessages = toInterviewMessages(ctx.messages);
          const interviewState = await extractInterviewState({
            messages: interviewMessages,
            currentOutline: options.currentOutline,
          });
          const sufficiency = evaluateInterviewSufficiency(interviewState, options.currentOutline);

          if (!sufficiency.allowOutline) {
            return {
              success: false,
              reason: sufficiency.reason,
              nextFocus: sufficiency.nextFocus,
            };
          }

          const outlineValidation = validateOutlineForState(outline, interviewState);
          if (!outlineValidation.valid) {
            return {
              success: false,
              reason: outlineValidation.reason,
              nextFocus: sufficiency.nextFocus,
            };
          }

          const result = await runCreateCourseWorkflow({
            userId: ctx.userId,
            courseId: ctx.resourceId,
            outline,
          });

          return {
            success: true,
            courseId: result.courseId,
            outline,
          };
        } catch (error) {
          console.error("[Interview] Failed to confirm outline:", error);
          return {
            success: false,
            reason: error instanceof Error ? error.message : "保存课程失败",
          };
        }
      },
    }),
  };
};

import type { UIDataTypes } from "ai";
import { getToolName, isDataUIPart, isToolUIPart, type UIMessage } from "ai";
import { z } from "zod";
import type { ConfirmOutlineOutput, ConfirmOutlineSchema } from "@/lib/ai/tools/interview";

export const InterviewOptionsDataSchema = z.object({
  options: z.array(z.string().min(1).max(80)).min(2).max(4),
});

export interface InterviewUIDataParts extends UIDataTypes {
  interviewOptions: z.infer<typeof InterviewOptionsDataSchema>;
}

export type InterviewUIMessage = UIMessage<
  never,
  InterviewUIDataParts,
  {
    confirmOutline: {
      input: z.infer<typeof ConfirmOutlineSchema>;
      output: ConfirmOutlineOutput;
    };
  }
>;

export function getInterviewMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

export function getInterviewMessageOptions(message: InterviewUIMessage): string[] {
  for (let i = message.parts.length - 1; i >= 0; i--) {
    const part = message.parts[i];
    if (isDataUIPart<InterviewUIDataParts>(part) && part.type === "data-interviewOptions") {
      return (part.data as InterviewUIDataParts["interviewOptions"]).options;
    }
  }

  return [];
}

export function findLatestOutline(messages: InterviewUIMessage[]): ConfirmOutlineOutput | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "assistant") {
      continue;
    }

    for (const part of message.parts) {
      if (
        isToolUIPart(part) &&
        getToolName(part) === "confirmOutline" &&
        part.state === "output-available"
      ) {
        const output = part.output as ConfirmOutlineOutput | undefined;
        if (output?.success && output.outline) {
          return output;
        }
      }
    }
  }

  return null;
}

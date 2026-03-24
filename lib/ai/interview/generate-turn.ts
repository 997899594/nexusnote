import { Output, streamText } from "ai";
import { getModelForPolicy } from "@/lib/ai/core";
import { buildInterviewPrompt, INTERVIEW_SYSTEM_PROMPT } from "./prompts";
import { type InterviewApiMessage, type InterviewOutline, InterviewTurnSchema } from "./schemas";

interface GenerateInterviewTurnOptions {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
}

export function generateInterviewTurn({ messages, currentOutline }: GenerateInterviewTurnOptions) {
  return streamText({
    model: getModelForPolicy("structured-high-quality"),
    system: INTERVIEW_SYSTEM_PROMPT,
    prompt: buildInterviewPrompt({ messages, currentOutline }),
    output: Output.object({
      schema: InterviewTurnSchema,
    }),
    temperature: 0.3,
    timeout: 60_000,
    experimental_telemetry: {
      isEnabled: false,
    },
  });
}

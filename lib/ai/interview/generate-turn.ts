import { Output, streamText } from "ai";
import { getJsonModelForPolicy } from "@/lib/ai/core";
import { buildInterviewPrompt, INTERVIEW_SYSTEM_PROMPT } from "./prompts";
import {
  type InterviewApiMessage,
  type InterviewOutline,
  type InterviewState,
  type InterviewSufficiency,
  InterviewTurnSchema,
} from "./schemas";

interface GenerateInterviewTurnOptions {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
  state: InterviewState;
  sufficiency: InterviewSufficiency;
}

export function generateInterviewTurn({
  messages,
  currentOutline,
  state,
  sufficiency,
}: GenerateInterviewTurnOptions) {
  return streamText({
    model: getJsonModelForPolicy("interactive-fast"),
    system: INTERVIEW_SYSTEM_PROMPT,
    prompt: buildInterviewPrompt({ messages, currentOutline, state, sufficiency }),
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

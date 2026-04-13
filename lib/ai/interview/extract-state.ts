import { generateText, Output } from "ai";
import { getJsonModelForPolicy } from "@/lib/ai/core";
import { buildInterviewStatePrompt, INTERVIEW_STATE_SYSTEM_PROMPT } from "./prompts";
import {
  type InterviewApiMessage,
  type InterviewOutline,
  type InterviewState,
  InterviewStateSchema,
} from "./schemas";

interface ExtractInterviewStateOptions {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
}

export async function extractInterviewState({
  messages,
  currentOutline,
}: ExtractInterviewStateOptions): Promise<InterviewState> {
  const result = await generateText({
    model: getJsonModelForPolicy("interactive-fast"),
    output: Output.object({ schema: InterviewStateSchema }),
    system: INTERVIEW_STATE_SYSTEM_PROMPT,
    prompt: buildInterviewStatePrompt({
      messages,
      currentOutline,
    }),
    temperature: 0.1,
    timeout: 30_000,
  });

  return result.output;
}

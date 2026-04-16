import { generateText, Output } from "ai";
import { getJsonModelForPolicy } from "@/lib/ai/core";
import {
  type InterviewApiMessage,
  type InterviewOutline,
  type InterviewState,
  InterviewStateSchema,
} from "./schemas";
import {
  buildStructuredInterviewStatePrompt,
  STRUCTURED_STATE_SYSTEM_PROMPT,
} from "./structured-prompts";

interface ExtractInterviewStateOptions {
  messages: InterviewApiMessage[];
  currentOutline?: InterviewOutline;
}

export async function extractInterviewState({
  messages,
  currentOutline,
}: ExtractInterviewStateOptions): Promise<InterviewState> {
  const result = await generateText({
    model: getJsonModelForPolicy("structured-high-quality"),
    output: Output.object({ schema: InterviewStateSchema }),
    system: STRUCTURED_STATE_SYSTEM_PROMPT,
    prompt: buildStructuredInterviewStatePrompt({
      messages,
      currentOutline,
    }),
    temperature: 0,
    timeout: 30_000,
  });

  return result.output;
}

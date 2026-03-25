import { generateObject } from "ai";
import { getModelForPolicy } from "@/lib/ai/core";
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
  const result = await generateObject({
    model: getModelForPolicy("structured-high-quality"),
    schema: InterviewStateSchema,
    system: INTERVIEW_STATE_SYSTEM_PROMPT,
    prompt: buildInterviewStatePrompt({
      messages,
      currentOutline,
    }),
    temperature: 0.1,
    timeout: 30_000,
  });

  return result.object;
}

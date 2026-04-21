import { generateText, Output } from "ai";
import { getJsonModelForPolicy } from "@/lib/ai/core/model-policy";
import { extractLatestUserMessageFromApiMessages } from "./message-history";
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

function buildDeterministicReviseState({
  messages,
  currentOutline,
}: ExtractInterviewStateOptions): InterviewState | null {
  if (!currentOutline) {
    return null;
  }

  const latestUserMessage = extractLatestUserMessageFromApiMessages(messages)?.trim();
  if (!latestUserMessage) {
    return null;
  }

  return {
    phase: "revise",
    topic: currentOutline.title,
    targetOutcome: currentOutline.learningOutcome,
    currentBaseline: currentOutline.targetAudience,
    constraints: [],
    revisionIntent: latestUserMessage.slice(0, 240),
    confidence: 0.9,
  };
}

export async function extractInterviewState({
  messages,
  currentOutline,
}: ExtractInterviewStateOptions): Promise<InterviewState> {
  const deterministicReviseState = buildDeterministicReviseState({
    messages,
    currentOutline,
  });
  if (deterministicReviseState) {
    return deterministicReviseState;
  }

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

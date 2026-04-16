import type { UIMessage } from "ai";
import { extractUIMessageText } from "@/lib/ai/message-text";
import type { InterviewApiMessage } from "./schemas";

export function extractLatestUserMessageFromUIMessages(messages?: UIMessage[]) {
  const latestUserTurn = [...(messages ?? [])].reverse().find((message) => message.role === "user");
  return latestUserTurn ? extractUIMessageText(latestUserTurn, { separator: "" }) : undefined;
}

export function extractLatestUserMessageFromApiMessages(messages: InterviewApiMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.text;
}

export function countUserTurnsFromUIMessages(messages?: UIMessage[]) {
  return (messages ?? []).filter((message) => message.role === "user").length;
}

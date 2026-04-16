import type { UIMessage } from "ai";

interface ExtractUIMessageTextOptions {
  separator?: string;
  trim?: boolean;
}

export function extractUIMessageText(
  message: Pick<UIMessage, "parts">,
  options: ExtractUIMessageTextOptions = {},
): string {
  const separator = options.separator ?? "\n";
  const shouldTrim = options.trim ?? true;

  if (!Array.isArray(message.parts)) {
    return "";
  }

  const segments: string[] = [];
  for (const part of message.parts) {
    if (part?.type === "text" && "text" in part && typeof part.text === "string") {
      segments.push(part.text);
    }
  }

  const text = segments.join(separator);

  return shouldTrim ? text.trim() : text;
}

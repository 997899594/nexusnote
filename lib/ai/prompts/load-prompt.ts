import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertServerRuntime } from "@/lib/runtime/assert-server-runtime";

const promptCache = new Map<string, string>();

assertServerRuntime("lib/ai/prompts/load-prompt");

export function loadPromptResource(filename: string): string {
  const cached = promptCache.get(filename);
  if (cached) {
    return cached;
  }

  const filePath = join(process.cwd(), "lib/ai/prompts/resources", filename);
  const content = readFileSync(filePath, "utf8").trim();
  promptCache.set(filename, content);
  return content;
}

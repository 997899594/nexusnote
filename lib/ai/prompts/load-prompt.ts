import { readFileSync } from "node:fs";
import { join } from "node:path";

const promptCache = new Map<string, string>();

if (typeof window !== "undefined") {
  throw new Error("lib/ai/prompts/load-prompt can only be imported on the server runtime.");
}

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

export function renderPromptResource(
  filename: string,
  variables: Record<string, string | number | boolean | null | undefined>,
): string {
  const template = loadPromptResource(filename);

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, rawKey) => {
    const key = String(rawKey);
    if (!(key in variables)) {
      throw new Error(`Missing prompt template variable "${key}" for ${filename}`);
    }

    const value = variables[key];
    return value == null ? "" : String(value);
  });
}

import type { AIModelSeries } from "./model-series";

export interface ModelToolCallingCapabilities {
  modelSeries: AIModelSeries | "unknown";
  namedToolChoice: {
    requiresNonThinkingMode: boolean;
  };
}

export interface ToolCallingRequestAdaptation {
  headers: Headers;
  body: Record<string, unknown>;
  changed: boolean;
}

const NATIVE_TOOL_USE_MODE = "2";

const MODEL_TOOL_CALLING_CAPABILITIES: Array<
  ModelToolCallingCapabilities & { modelIdPatterns: RegExp[] }
> = [
  {
    modelSeries: "qwen",
    modelIdPatterns: [/qwen/iu],
    namedToolChoice: {
      requiresNonThinkingMode: true,
    },
  },
  {
    modelSeries: "deepseek",
    modelIdPatterns: [/deepseek/iu],
    namedToolChoice: {
      requiresNonThinkingMode: false,
    },
  },
  {
    modelSeries: "gemini",
    modelIdPatterns: [/gemini/iu],
    namedToolChoice: {
      requiresNonThinkingMode: false,
    },
  },
  {
    modelSeries: "openai",
    modelIdPatterns: [/gpt-|o[1345]|chatgpt/iu],
    namedToolChoice: {
      requiresNonThinkingMode: false,
    },
  },
];

const UNKNOWN_TOOL_CALLING_CAPABILITIES: ModelToolCallingCapabilities = {
  modelSeries: "unknown",
  namedToolChoice: {
    requiresNonThinkingMode: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasTools(body: Record<string, unknown>): boolean {
  return Array.isArray(body.tools) && body.tools.length > 0;
}

function hasNamedToolChoice(body: Record<string, unknown>): boolean {
  const toolChoice = body.tool_choice;
  return (
    isRecord(toolChoice) &&
    toolChoice.type === "function" &&
    isRecord(toolChoice.function) &&
    typeof toolChoice.function.name === "string" &&
    toolChoice.function.name.length > 0
  );
}

export function parseModelGatewayJsonBody(
  body: BodyInit | null | undefined,
): Record<string, unknown> | null {
  if (typeof body !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(body);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function resolveModelToolCallingCapabilities(
  modelId: unknown,
): ModelToolCallingCapabilities {
  if (typeof modelId !== "string") {
    return UNKNOWN_TOOL_CALLING_CAPABILITIES;
  }

  const match = MODEL_TOOL_CALLING_CAPABILITIES.find((capabilities) =>
    capabilities.modelIdPatterns.some((pattern) => pattern.test(modelId)),
  );

  return match ?? UNKNOWN_TOOL_CALLING_CAPABILITIES;
}

export function adapt302ToolCallingRequest(params: {
  body: Record<string, unknown>;
  headers: Headers;
}): ToolCallingRequestAdaptation {
  if (!hasTools(params.body)) {
    return {
      body: params.body,
      headers: params.headers,
      changed: false,
    };
  }

  const headers = new Headers(params.headers);
  headers.set("tool-use-mode", NATIVE_TOOL_USE_MODE);

  const capabilities = resolveModelToolCallingCapabilities(params.body.model);
  if (capabilities.namedToolChoice.requiresNonThinkingMode && hasNamedToolChoice(params.body)) {
    return {
      headers,
      body: {
        ...params.body,
        enable_thinking: false,
      },
      changed: true,
    };
  }

  return {
    body: params.body,
    headers,
    changed: true,
  };
}

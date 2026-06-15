import type { AIModelSeries } from "./model-series";

interface ModelToolCallingCapabilities {
  modelSeries: AIModelSeries | "unknown";
  namedToolChoice: {
    requiresNonThinkingMode: boolean;
  };
  structuredOutput: {
    mode: "json_schema" | "json_object";
    requiresNonThinkingMode: boolean;
  };
}

export interface ModelRequestAdaptation {
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
    structuredOutput: {
      mode: "json_schema",
      requiresNonThinkingMode: true,
    },
  },
  {
    modelSeries: "deepseek",
    modelIdPatterns: [/deepseek/iu],
    namedToolChoice: {
      requiresNonThinkingMode: false,
    },
    structuredOutput: {
      mode: "json_object",
      requiresNonThinkingMode: false,
    },
  },
  {
    modelSeries: "gemini",
    modelIdPatterns: [/gemini/iu],
    namedToolChoice: {
      requiresNonThinkingMode: false,
    },
    structuredOutput: {
      mode: "json_schema",
      requiresNonThinkingMode: false,
    },
  },
  {
    modelSeries: "openai",
    modelIdPatterns: [/gpt-|o[1345]|chatgpt/iu],
    namedToolChoice: {
      requiresNonThinkingMode: false,
    },
    structuredOutput: {
      mode: "json_schema",
      requiresNonThinkingMode: false,
    },
  },
];

const UNKNOWN_TOOL_CALLING_CAPABILITIES: ModelToolCallingCapabilities = {
  modelSeries: "unknown",
  namedToolChoice: {
    requiresNonThinkingMode: false,
  },
  structuredOutput: {
    mode: "json_schema",
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

function hasJsonSchemaResponseFormat(body: Record<string, unknown>): boolean {
  return isRecord(body.response_format) && body.response_format.type === "json_schema";
}

function getStructuredOutputSchema(body: Record<string, unknown>): unknown {
  if (!isRecord(body.response_format) || !isRecord(body.response_format.json_schema)) {
    return null;
  }

  return body.response_format.json_schema.schema ?? null;
}

function buildStructuredOutputSchemaInstruction(body: Record<string, unknown>): string | null {
  const schema = getStructuredOutputSchema(body);
  if (!schema) {
    return null;
  }

  const schemaText = JSON.stringify(schema);
  return [
    "The response must be a JSON object that conforms to this JSON Schema.",
    "Return JSON only. Do not include markdown, prose, or code fences.",
    schemaText,
  ].join("\n");
}

function withStructuredOutputSchemaInstruction(
  messages: unknown,
  instruction: string | null,
): unknown {
  if (!instruction || !Array.isArray(messages)) {
    return messages;
  }

  const systemMessageIndex = messages.findIndex(
    (message) =>
      isRecord(message) &&
      (message.role === "system" || message.role === "developer") &&
      typeof message.content === "string",
  );

  if (systemMessageIndex >= 0) {
    return messages.map((message, index) => {
      if (
        index !== systemMessageIndex ||
        !isRecord(message) ||
        typeof message.content !== "string"
      ) {
        return message;
      }

      return {
        ...message,
        content: `${message.content}\n\n${instruction}`,
      };
    });
  }

  return [
    {
      role: "system",
      content: instruction,
    },
    ...messages,
  ];
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

function resolveModelToolCallingCapabilities(modelId: unknown): ModelToolCallingCapabilities {
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
}): ModelRequestAdaptation {
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

export function adapt302StructuredOutputRequest(params: {
  body: Record<string, unknown>;
  headers: Headers;
}): ModelRequestAdaptation {
  if (!hasJsonSchemaResponseFormat(params.body)) {
    return {
      body: params.body,
      headers: params.headers,
      changed: false,
    };
  }

  const capabilities = resolveModelToolCallingCapabilities(params.body.model);
  const adaptedBody = { ...params.body };

  if (capabilities.structuredOutput.mode === "json_object") {
    adaptedBody.response_format = { type: "json_object" };
    adaptedBody.messages = withStructuredOutputSchemaInstruction(
      params.body.messages,
      buildStructuredOutputSchemaInstruction(params.body),
    );
  }

  if (capabilities.structuredOutput.requiresNonThinkingMode) {
    adaptedBody.enable_thinking = false;
  }

  return {
    body: adaptedBody,
    headers: params.headers,
    changed:
      capabilities.structuredOutput.mode !== "json_schema" ||
      capabilities.structuredOutput.requiresNonThinkingMode,
  };
}

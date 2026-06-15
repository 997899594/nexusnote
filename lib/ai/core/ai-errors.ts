import { APICallError } from "@ai-sdk/provider";

export interface NormalizedAIError {
  code: string;
  message: string;
  statusCode?: number;
  providerCode?: string;
  providerType?: string;
  providerMessage?: string;
  responseBody?: string;
}

const MAX_RESPONSE_BODY_LENGTH = 2_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function parseProviderError(responseBody: string | undefined): {
  code?: string;
  type?: string;
  message?: string;
} {
  if (!responseBody) {
    return {};
  }

  try {
    const parsed = JSON.parse(responseBody);
    if (!isRecord(parsed) || !isRecord(parsed.error)) {
      return {};
    }

    return {
      code: typeof parsed.error.code === "string" ? parsed.error.code : undefined,
      type: typeof parsed.error.type === "string" ? parsed.error.type : undefined,
      message: typeof parsed.error.message === "string" ? parsed.error.message : undefined,
    };
  } catch {
    return {};
  }
}

export function normalizeAIError(error: unknown): NormalizedAIError {
  if (APICallError.isInstance(error)) {
    const providerError = parseProviderError(error.responseBody);
    const message = providerError.message ?? error.message;

    return {
      code:
        providerError.code ?? (error.statusCode ? `AI_HTTP_${error.statusCode}` : "AI_API_ERROR"),
      message,
      statusCode: error.statusCode,
      providerCode: providerError.code,
      providerType: providerError.type,
      providerMessage: providerError.message,
      responseBody: error.responseBody
        ? truncate(error.responseBody, MAX_RESPONSE_BODY_LENGTH)
        : undefined,
    };
  }

  return {
    code: "AI_ERROR",
    message: getErrorMessage(error),
  };
}

export function getAIErrorMessage(error: unknown): string {
  return normalizeAIError(error).message;
}

import { getAIErrorMessage, normalizeAIError } from "@/lib/ai/core/ai-errors";

type StructuredLogLevel = "debug" | "info" | "warn" | "error";

const MAX_LOG_STRING_LENGTH = 4_000;
const ERROR_DETAIL_KEYS = [
  "code",
  "status",
  "statusCode",
  "responseBody",
  "data",
  "isRetryable",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function truncateString(value: string, maxLength = MAX_LOG_STRING_LENGTH): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...<truncated>` : value;
}

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return truncateString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= 2) {
      return `[array:${value.length}]`;
    }

    return value.slice(0, 20).map((item) => sanitizeForLog(item, depth + 1));
  }

  if (!isRecord(value)) {
    return String(value);
  }

  if (depth >= 2) {
    return "[object]";
  }

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    if (/authorization|cookie|secret|token|api[-_]?key|password/i.test(key)) {
      output[key] = "<redacted>";
      continue;
    }

    output[key] = sanitizeForLog(nestedValue, depth + 1);
  }

  return output;
}

function readErrorDetail(errorRecord: Record<string, unknown>, key: string): unknown {
  const value = errorRecord[key];
  return value === undefined ? undefined : sanitizeForLog(value);
}

export function getErrorMessage(error: unknown): string {
  return getAIErrorMessage(error);
}

export function buildErrorLogFields(error: unknown): Record<string, unknown> {
  const record = isRecord(error) ? error : {};
  const normalizedAIError = normalizeAIError(error);
  const fields: Record<string, unknown> = {
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: getErrorMessage(error),
    errorCode: normalizedAIError.code,
    errorStatusCode: normalizedAIError.statusCode ?? null,
    errorProviderCode: normalizedAIError.providerCode ?? null,
    errorProviderType: normalizedAIError.providerType ?? null,
    errorProviderMessage: normalizedAIError.providerMessage ?? null,
    errorStack: error instanceof Error ? (error.stack ?? null) : null,
  };

  for (const key of ERROR_DETAIL_KEYS) {
    const value = readErrorDetail(record, key);
    if (value !== undefined) {
      fields[`error${key[0].toUpperCase()}${key.slice(1)}`] = value;
    }
  }

  const cause = record.cause;
  if (cause instanceof Error) {
    fields.errorCause = {
      name: cause.name,
      message: cause.message,
      stack: cause.stack ?? null,
    };
  } else if (cause !== undefined) {
    fields.errorCause = sanitizeForLog(cause);
  }

  return fields;
}

export function writeStructuredLog(
  level: StructuredLogLevel,
  event: string,
  fields: Record<string, unknown> = {},
): void {
  const safeFields = sanitizeForLog(fields);
  const line = JSON.stringify({
    level,
    event,
    timestamp: new Date().toISOString(),
    ...(isRecord(safeFields) ? safeFields : {}),
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

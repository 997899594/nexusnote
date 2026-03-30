export type AIDegradationKind =
  | "chat_unavailable"
  | "structured_unavailable"
  | "embedding_unavailable"
  | "unknown";

export interface AIDegradationState {
  kind: AIDegradationKind;
  code: string;
  statusCode: number;
  userMessage: string;
  shouldExposeAsServiceUnavailable: boolean;
}

type FetchWithPreconnect = typeof globalThis.fetch & {
  preconnect?: (input: string | URL) => void;
};

function normalizeMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.toLowerCase();
  }

  return String(error).toLowerCase();
}

export function classifyAIDegradation(error: unknown): AIDegradationState | null {
  const message = normalizeMessage(error);

  if (
    message.includes("no available models") ||
    message.includes("model unavailable") ||
    message.includes("service unavailable") ||
    message.includes("temporarily unavailable") ||
    message.includes("503")
  ) {
    return {
      kind: "chat_unavailable",
      code: "AI_TEMPORARILY_UNAVAILABLE",
      statusCode: 503,
      userMessage: "AI 服务暂时不可用，请稍后重试。",
      shouldExposeAsServiceUnavailable: true,
    };
  }

  if (message.includes("no object generated") || message.includes("schema")) {
    return {
      kind: "structured_unavailable",
      code: "AI_STRUCTURED_OUTPUT_UNAVAILABLE",
      statusCode: 503,
      userMessage: "结构化 AI 结果暂时不可用，请稍后重试。",
      shouldExposeAsServiceUnavailable: true,
    };
  }

  if (message.includes("embedding")) {
    return {
      kind: "embedding_unavailable",
      code: "AI_EMBEDDING_UNAVAILABLE",
      statusCode: 503,
      userMessage: "向量能力暂时不可用，系统已进入降级模式。",
      shouldExposeAsServiceUnavailable: false,
    };
  }

  return null;
}

export function parseAIDegradationKind(value: string | null | undefined): AIDegradationKind | null {
  if (
    value === "chat_unavailable" ||
    value === "structured_unavailable" ||
    value === "embedding_unavailable" ||
    value === "unknown"
  ) {
    return value;
  }

  return null;
}

export function getAIDegradationTitle(kind: AIDegradationKind): string {
  switch (kind) {
    case "chat_unavailable":
      return "AI 对话服务暂时不可用";
    case "structured_unavailable":
      return "结构化生成暂时不稳定";
    case "embedding_unavailable":
      return "检索增强暂时降级";
    default:
      return "AI 服务进入降级模式";
  }
}

export function getAIDegradationMessage(kind: AIDegradationKind): string {
  switch (kind) {
    case "chat_unavailable":
      return "当前请求已进入降级模式，建议稍后重试。";
    case "structured_unavailable":
      return "本次回答可能无法稳定产出大纲或结构化结果，建议重试。";
    case "embedding_unavailable":
      return "本次回答可能缺少向量检索增强，但基础对话仍可继续。";
    default:
      return "AI 服务存在临时异常，当前结果可能不完整。";
  }
}

export function createAIDegradationAwareFetch(options?: {
  fetch?: typeof globalThis.fetch;
  onStateChange?: (kind: AIDegradationKind | null) => void;
  onUnauthorized?: () => void;
}): typeof globalThis.fetch {
  const baseFetch = (options?.fetch ?? globalThis.fetch) as FetchWithPreconnect;

  const wrappedFetch = Object.assign(
    async (input: URL | RequestInfo, init?: RequestInit) => {
      const response = await baseFetch(input, init);
      options?.onStateChange?.(parseAIDegradationKind(response.headers.get("X-AI-Degraded")));

      if (response.status === 401) {
        options?.onUnauthorized?.();
      }

      return response;
    },
    {
      preconnect:
        typeof baseFetch.preconnect === "function"
          ? baseFetch.preconnect.bind(baseFetch)
          : (_input: string | URL) => {},
    },
  ) satisfies FetchWithPreconnect;

  return wrappedFetch as typeof globalThis.fetch;
}

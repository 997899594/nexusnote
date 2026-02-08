/**
 * Langfuse Observability Client (2026 Modern Stack)
 *
 * AI SDK v6 官方推荐的可观测性方案
 * 自动追踪：tokens、成本、延迟、工具调用、错误
 *
 * @see https://langfuse.com/docs/integrations/vercel-ai-sdk
 */

import Langfuse from 'langfuse';
import { env } from '@nexusnote/config';

// 仅在服务端且配置了 API Keys 时初始化
let langfuseClient: Langfuse | null = null;

if (typeof window === 'undefined') {
  const publicKey = env.LANGFUSE_PUBLIC_KEY;
  const secretKey = env.LANGFUSE_SECRET_KEY;

  if (publicKey && secretKey) {
    langfuseClient = new Langfuse({
      publicKey,
      secretKey,
      baseUrl: 'https://cloud.langfuse.com',
      // 可选：本地开发时可以设置为 false
      enabled: process.env.NODE_ENV === 'production',
    });

    console.log('[Langfuse] Observability enabled ✅');
  } else {
    console.log('[Langfuse] API keys not configured, observability disabled');
  }
}

export const langfuse = langfuseClient;

/**
 * 检查 Langfuse 是否已配置
 */
export function isLangfuseEnabled(): boolean {
  return langfuseClient !== null;
}

/**
 * 为 AI SDK v6 生成遥测配置
 *
 * @example
 * const result = streamText({
 *   model: chatModel,
 *   messages,
 *   experimental_telemetry: createTelemetryConfig('chat-agent', { userId: 'user-123' }),
 * });
 */
export function createTelemetryConfig(
  functionId: string,
  metadata?: Record<string, string | number | boolean>,
  traceId?: string,
) {
  if (!isLangfuseEnabled()) {
    return undefined;
  }

  return {
    isEnabled: true,
    functionId,
    traceId, // 2026 架构师建议：显式传递 traceId 以实现链路追踪
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
    },
  };
}

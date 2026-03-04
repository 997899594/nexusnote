/**
 * AI Streaming Helper
 *
 * 封装 createAgentUIStreamResponse，统一处理类型转换
 */

import { createAgentUIStreamResponse, smoothStream, type UIMessage } from "ai";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAgent = any;

/**
 * 创建 NexusNote 流式响应
 *
 * 封装了：
 * - Agent 类型转换（统一不同 Agent 类型）
 * - 中文流式分词
 * - 响应头设置
 */
export async function createNexusNoteStreamResponse(
  agent: AnyAgent,
  messages: UIMessage[],
): Promise<Response> {
  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    experimental_transform: smoothStream({
      chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
    }),
  });
}

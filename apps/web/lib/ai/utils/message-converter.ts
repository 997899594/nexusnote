/**
 * Message Converter - 统一消息格式转换
 *
 * 解决 UI Messages (useChat) 和 Model Messages (Agent) 的格式差异
 */

import { convertToModelMessages } from 'ai';
import type { ToolLoopAgent } from 'ai';

/**
 * 包装 Agent 的 stream 方法，自动转换消息格式
 *
 * @example
 * const result = await streamWithConversion(interviewAgent, {
 *   messages: uiMessages,
 *   options: {...}
 * });
 */
export async function streamWithConversion<TAgent extends ToolLoopAgent<any, any, any>>(
  agent: TAgent,
  params: {
    messages: any[];
    options?: any;
  }
) {
  // 自动转换 UI Messages -> Model Messages
  const modelMessages = await convertToModelMessages(params.messages);

  return agent.stream({
    ...params,
    messages: modelMessages,
  });
}

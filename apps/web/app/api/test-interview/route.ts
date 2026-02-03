import { createInterviewAgent } from '@/lib/ai/agents/interview/agent';
import { isAIConfigured, getAIProviderInfo } from '@/lib/ai/registry';
import { convertToModelMessages } from 'ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * TEST ONLY - 临时测试端点（无认证）
 *
 * 用于验证 Interview Agent 的功能（AI SDK 6 - ToolLoopAgent）
 * 生产环境请删除此文件！
 */

export async function POST(req: Request) {
  const { messages, interviewContext = {} } = await req.json();

  if (!isAIConfigured()) {
    const info = getAIProviderInfo();
    return Response.json(
      { error: `AI API key not configured. Provider: ${info.provider}` },
      { status: 500 }
    );
  }

  try {
    console.log('[TEST] Running interview with messages:', messages.length);
    console.log('[TEST] Context:', interviewContext);

    const convertedMessages = await convertToModelMessages(messages);
    const agent = createInterviewAgent(interviewContext);
    const result = await agent.stream({ messages: convertedMessages });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[TEST] Interview API Error:', error);
    return Response.json(
      { error: `Failed: ${(error as Error).message}` },
      { status: 500 }
    );
  }
}

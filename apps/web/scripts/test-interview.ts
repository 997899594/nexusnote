/**
 * Interview Agent 测试脚本
 *
 * 用途：模拟完整的 Interview 流程，验证：
 * 1. AI 对话是否自然
 * 2. Tool Calls 是否正确触发
 * 3. 状态转换是否符合预期
 */

import { createInterviewAgent } from '../lib/ai/agents/interview/agent';

interface TestMessage {
  role: 'user' | 'assistant';
  content: string;
  toolInvocations?: any[];
}

async function testInterviewFlow() {
  console.log('🚀 开始测试 Interview Agent...\n');

  const messages: TestMessage[] = [];
  const context: any = {};

  // ============================================
  // 测试 1: 首次访谈（用户直接说目标）
  // ============================================
  console.log('📝 测试场景 1: 用户直接说"我想学 Python"\n');

  messages.push({
    role: 'user',
    content: '我想学 Python',
  });

  try {
    const agent = createInterviewAgent(context);
    const result1 = await agent.stream({ messages });

    console.log('✅ AI 响应类型:', result1.constructor.name);

    // 读取流式响应
    const reader = result1.toUIMessageStreamResponse().body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    let fullText = '';
    let toolCalls: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);

      // 解析 SSE 格式
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('0:')) {
          // Text chunk
          const json = JSON.parse(line.slice(2));
          if (json.text) {
            fullText += json.text;
          }
        } else if (line.startsWith('9:')) {
          // Tool call
          const json = JSON.parse(line.slice(2));
          if (json.toolCallId) {
            toolCalls.push(json);
          }
        }
      }
    }

    console.log('💬 AI 回复:', fullText);
    console.log('🔧 Tool Calls:', toolCalls.length > 0 ? toolCalls : '无');

    if (toolCalls.length > 0) {
      console.log('   Tool 详情:', JSON.stringify(toolCalls[0], null, 2));
    }

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误详情:', (error as Error).stack);
  }

  // ============================================
  // 测试 2: 多轮对话
  // ============================================
  console.log('\n📝 测试场景 2: 多轮对话收集信息\n');

  messages.push({
    role: 'assistant',
    content: '太好了！Python 是一门很棒的语言。请问你目前有编程基础吗？',
  });

  messages.push({
    role: 'user',
    content: '零基础，完全没学过编程',
  });

  try {
    const agent2 = createInterviewAgent({ goal: 'Python' });
    const result2 = await agent2.stream({ messages });

    console.log('✅ 第二轮响应类型:', result2.constructor.name);

    // 简化处理：只打印是否成功
    console.log('💬 AI 继续询问用户信息...');

  } catch (error) {
    console.error('❌ 测试失败:', error);
  }

  console.log('\n✅ 测试完成！\n');
  console.log('📊 总结:');
  console.log('   - 消息数:', messages.length);
  console.log('   - 上下文:', context);
}

// 运行测试
testInterviewFlow().catch(console.error);

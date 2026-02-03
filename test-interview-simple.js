/**
 * Interview Agent 简单测试
 *
 * 直接测试 AI Agent 函数，绕过认证
 */

const { runInterview } = require('./apps/web/lib/ai/agents/interview/agent.ts');

async function test() {
  console.log('🚀 开始测试 Interview Agent...\n');

  // 测试 1: 用户说"我想学 Python"
  console.log('📝 测试: 用户说"我想学 Python"\n');

  const messages = [
    {
      role: 'user',
      content: '我想学 Python',
    }
  ];

  try {
    const result = await runInterview(messages, {});

    console.log('✅ AI Agent 返回结果类型:', result.constructor.name);

    // 尝试读取流
    const response = await result.toUIMessageStreamResponse();
    console.log('✅ Response 创建成功');

    // 读取流内容
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullText = '';
    let toolCalls = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        if (line.startsWith('0:')) {
          // Text chunk
          const json = JSON.parse(line.slice(2));
          if (json.text) fullText += json.text;
        } else if (line.startsWith('9:')) {
          // Tool call
          const json = JSON.parse(line.slice(2));
          toolCalls.push(json);
        }
      }
    }

    console.log('\n💬 AI 回复:', fullText);
    console.log('\n🔧 Tool Calls:', toolCalls.length);
    if (toolCalls.length > 0) {
      console.log(JSON.stringify(toolCalls[0], null, 2));
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  }
}

test();

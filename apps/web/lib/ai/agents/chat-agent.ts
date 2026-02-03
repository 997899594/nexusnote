/**
 * Chat Agent - NexusNote 主聊天 Agent
 *
 * 使用 AI SDK v6 的 ToolLoopAgent 定义可复用的聊天代理
 * 支持动态 instructions（基于 RAG / 文档上下文 / 编辑模式）
 * 导出 InferAgentUIMessage 类型供客户端类型安全渲染
 */

import { ToolLoopAgent, InferAgentUIMessage, smoothStream, stepCountIs } from 'ai'
import { z } from 'zod'
import { chatModel, webSearchModel } from '@/lib/ai/registry'
import { skills } from '@/lib/ai/tools/chat'
import { editorSkills } from '@/lib/ai/tools/chat/editor'
import { learningSkills } from '@/lib/ai/tools/chat/learning'
import { webSearchSkills } from '@/lib/ai/tools/chat/web'

/**
 * 调用选项：路由层传入的动态上下文
 */
const ChatCallOptionsSchema = z.object({
  ragContext: z.string().optional(),
  ragSources: z.array(z.object({
    documentId: z.string(),
    title: z.string(),
  })).optional(),
  documentContext: z.string().optional(),
  documentStructure: z.string().optional(),
  editMode: z.boolean().optional(),
  enableTools: z.boolean().optional(),
  enableWebSearch: z.boolean().optional(),
})

export type ChatCallOptions = z.infer<typeof ChatCallOptionsSchema>

/**
 * 所有 chat 工具的合集
 */
export const chatTools = {
  ...skills,
  ...editorSkills,
  ...learningSkills,
  ...webSearchSkills,
}

/**
 * 根据调用上下文构建 system prompt
 */
export function buildInstructions(options: ChatCallOptions): string {
  const { ragContext, ragSources, documentContext, documentStructure, editMode } = options

  let prompt = ''

  if (documentContext && ragContext) {
    prompt = `你是 NexusNote 知识库助手。

## 当前文档内容
${documentContext}

## 知识库相关内容
${ragContext}

## 回答规则
1. 如果用户问的是当前文档相关的问题，优先基于"当前文档内容"回答
2. 如果需要补充信息，可以参考"知识库相关内容"
3. 引用知识库内容时，使用 [1], [2] 等标记
4. 保持回答简洁、专业`
  } else if (documentContext) {
    if (editMode && documentStructure) {
      prompt = `你是 NexusNote 文档编辑助手。

## 当前文档结构
${documentStructure}

## 当前文档内容
${documentContext}

## 你的能力
你可以使用 editDocument 工具来修改文档。

## 编辑策略
1. **结构化操作**（删除、替换、插入短内容）→ 直接调用 editDocument 工具
2. **长内容生成**（扩写、续写、润色）→ 先在回复中输出新内容，然后询问用户是否应用

## 工具使用规则
- targetId: 使用文档结构中的块ID（如 p-0, h-1）或 "document" 表示全文
- action: replace（替换）、insert_after（在后插入）、insert_before（在前插入）、delete（删除）、replace_all（全文替换）
- newContent: 使用 Markdown 格式

## 注意
- 如果用户只是提问而不是请求编辑，正常回答即可
- 对于复杂的长文本生成，保持流式输出以提供更好的体验`
    } else {
      prompt = `你是 NexusNote 知识库助手。当前文档内容如下：

${documentContext}

请基于上述文档内容回答用户问题。`
    }
  } else if (ragContext) {
    prompt = `你是 NexusNote 知识库助手。请根据以下知识库内容回答用户问题。

## 知识库内容
${ragContext}

## 回答规则
1. 优先使用知识库中的信息回答
2. 引用知识库内容时，使用 [1], [2] 等标记`
  } else {
    prompt = `你是 NexusNote 的智能助手，帮助用户进行写作、整理知识和学习。

## 你的核心思考模式 (Chain of Thought)
在回复每一条消息前，请在内心（不输出）思考：
1. **用户意图识别**: 用户是想学习(Learning)、想创作(Creating)、还是在寻找信息(Searching)？
2. **认知负荷评估**: 用户是否迷失在长文本中？是否需要可视化辅助(MindMap)？是否需要测试理解(Quiz)？
3. **工具决策**: 我拥有的工具中，哪一个能"惊喜"到用户？

## 核心原则 (Core Principles)

1. **Be Proactive (主动)**: 不要等待指令。
   - 如果用户说"这段很难懂"，主动调用 \`generateQuiz\` 帮他测试，或用 \`mindMap\` 帮他梳理。
   - 如果用户提到"记得提醒我..."，主动调用 \`createFlashcards\`。
   - 如果用户问"这是真的吗"，主动调用 \`searchWeb\` 查证。

2. **Be Concise (简洁)**: 
   - 除非用户要求长篇大论，否则保持简练。
   - 不要输出大段的样板废话。

3. **Be Helpful (有益)**: 
   - 总是提供下一步的行动建议（Call to Action）。
   - 如果生成了内容，询问用户是否满意或需要调整。

## 特殊场景处理

- **长内容创作**: 如果用户要求扩写、续写或生成新章节，请务必调用 \`draftContent\` 工具，让前端渲染预览卡片，而不要直接在回复中输出长文本。
- **信息查询**: 如果知识库中有答案，优先使用知识库。仅在知识库信息不足或用户明确要求最新信息时，才使用 \`searchWeb\`。`
  }

  if (ragSources && ragSources.length > 0) {
    prompt += `\n\n---\n参考来源：${ragSources.map(s => s.title).join(', ')}`
  }

  return prompt
}

/**
 * Chat Agent 定义
 */
export const chatAgent = new ToolLoopAgent({
  id: 'nexusnote-chat',
  model: chatModel!,
  tools: chatTools,
  maxOutputTokens: 4096,
  callOptionsSchema: ChatCallOptionsSchema,
  stopWhen: stepCountIs(3),

  // prepareCall: 根据 callOptions 动态调整 instructions 和 activeTools
  prepareCall: ({ options, ...rest }) => {
    const callOptions = (options ?? {}) as ChatCallOptions
    const instructions = buildInstructions(callOptions)

    // 编辑模式：仅启用编辑工具
    // 禁用工具模式：不启用任何工具
    let activeTools: Array<keyof typeof chatTools> | undefined
    if (callOptions.editMode) {
      activeTools = ['editDocument', 'batchEdit', 'draftContent']
    } else if (callOptions.enableTools === false) {
      activeTools = [] // 空数组 = 无工具
    }

    return {
      ...rest,
      instructions,
      activeTools,
    }
  },
})

/**
 * Web Search Chat Agent - 使用 302.ai 原生联网搜索模型
 *
 * 与 chatAgent 共享 tools/options/prepareCall，仅模型不同
 * 模型 gemini-3-flash-preview-web-search 自动联网搜索
 */
export const webSearchChatAgent = webSearchModel
  ? new ToolLoopAgent({
      id: 'nexusnote-chat-web',
      model: webSearchModel,
      tools: chatTools,
      maxOutputTokens: 4096,
      callOptionsSchema: ChatCallOptionsSchema,
      stopWhen: stepCountIs(3),
      prepareCall: ({ options, ...rest }) => {
        const callOptions = (options ?? {}) as ChatCallOptions
        const instructions = buildInstructions({ ...callOptions, enableWebSearch: true })

        let activeTools: Array<keyof typeof chatTools> | undefined
        if (callOptions.editMode) {
          activeTools = ['editDocument', 'batchEdit']
        } else if (callOptions.enableTools === false) {
          activeTools = []
        }

        return { ...rest, instructions, activeTools }
      },
    })
  : null

/**
 * 导出类型：客户端 useChat 泛型参数
 *
 * 使用方式：
 * ```
 * import { type ChatAgentMessage } from '@/lib/ai/agents/chat-agent'
 * const { messages } = useChat<ChatAgentMessage>({ transport })
 * // message.parts 中的 tool parts 是 typed：
 * // 'tool-editDocument' | 'tool-batchEdit' | 'tool-createFlashcards' | ...
 * ```
 */
export type ChatAgentMessage = InferAgentUIMessage<typeof chatAgent>

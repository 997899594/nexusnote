import { Editor } from '@tiptap/react'
import { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { smartConvert, sanitizeHtml } from './markdown'

// ============================================
// 文档结构解析器
// 用于 AI 对话编辑时定位和操作文档块
// ============================================

export interface DocumentBlock {
  id: string           // 唯一标识 (e.g., "p-0", "h1-1", "list-2")
  type: string         // 节点类型 (paragraph, heading, bulletList, etc.)
  level?: number       // 标题级别 (1-6)
  content: string      // 纯文本内容
  from: number         // ProseMirror 起始位置
  to: number           // ProseMirror 结束位置
  index: number        // 在同类型块中的索引
  globalIndex: number  // 全局块索引
}

export interface DocumentStructure {
  blocks: DocumentBlock[]
  totalBlocks: number
  headings: DocumentBlock[]
  paragraphs: DocumentBlock[]
}

/**
 * 解析编辑器文档结构
 */
export function parseDocument(editor: Editor): DocumentStructure {
  const doc = editor.state.doc
  const blocks: DocumentBlock[] = []
  const typeCounters: Record<string, number> = {}
  let globalIndex = 0

  doc.forEach((node, offset) => {
    const block = parseNode(node, offset, typeCounters, globalIndex)
    if (block) {
      blocks.push(block)
      globalIndex++
    }
  })

  return {
    blocks,
    totalBlocks: blocks.length,
    headings: blocks.filter(b => b.type === 'heading'),
    paragraphs: blocks.filter(b => b.type === 'paragraph'),
  }
}

function parseNode(
  node: ProseMirrorNode,
  offset: number,
  typeCounters: Record<string, number>,
  globalIndex: number
): DocumentBlock | null {
  const type = node.type.name

  // 跳过空节点
  if (node.isTextblock && node.textContent.trim() === '') {
    return null
  }

  // 计算类型内索引
  typeCounters[type] = (typeCounters[type] || 0) + 1
  const index = typeCounters[type] - 1

  // 生成唯一 ID
  const prefix = getTypePrefix(type)
  const id = `${prefix}-${index}`

  return {
    id,
    type,
    level: type === 'heading' ? node.attrs.level : undefined,
    content: node.textContent,
    from: offset,
    to: offset + node.nodeSize,
    index,
    globalIndex,
  }
}

function getTypePrefix(type: string): string {
  const prefixMap: Record<string, string> = {
    paragraph: 'p',
    heading: 'h',
    bulletList: 'ul',
    orderedList: 'ol',
    taskList: 'task',
    blockquote: 'quote',
    codeBlock: 'code',
    table: 'table',
    callout: 'callout',
    collapsible: 'toggle',
  }
  return prefixMap[type] || type.slice(0, 3)
}

/**
 * 解析自然语言引用，找到对应的块
 * 支持: "第一段", "第二个标题", "引言部分", "最后一段" 等
 */
export function resolveBlockReference(
  reference: string,
  structure: DocumentStructure
): DocumentBlock | null {
  const ref = reference.toLowerCase().trim()

  // 数字引用: "第一段", "第2段", "第三个标题"
  const numMatch = ref.match(/第\s*([一二三四五六七八九十\d]+)\s*(段|个?段落|个?标题|个?列表)/)
  if (numMatch) {
    const num = parseChineseNumber(numMatch[1])
    const typeKeyword = numMatch[2]

    if (typeKeyword.includes('标题')) {
      return structure.headings[num - 1] || null
    } else {
      return structure.paragraphs[num - 1] || null
    }
  }

  // 位置引用: "最后一段", "开头", "结尾"
  if (ref.includes('最后') || ref.includes('末尾')) {
    if (ref.includes('标题')) {
      return structure.headings[structure.headings.length - 1] || null
    }
    return structure.paragraphs[structure.paragraphs.length - 1] || null
  }

  if (ref.includes('第一') || ref.includes('开头') || ref.includes('开始')) {
    if (ref.includes('标题')) {
      return structure.headings[0] || null
    }
    return structure.paragraphs[0] || null
  }

  // ID 引用: "p-0", "h-1"
  const idMatch = ref.match(/^([a-z]+)-(\d+)$/)
  if (idMatch) {
    return structure.blocks.find(b => b.id === ref) || null
  }

  // 全局索引引用: "block 3", "第3块"
  const blockMatch = ref.match(/(?:block\s*|第\s*)(\d+)(?:\s*块)?/)
  if (blockMatch) {
    const idx = parseInt(blockMatch[1], 10) - 1
    return structure.blocks[idx] || null
  }

  return null
}

function parseChineseNumber(str: string): number {
  const chineseNums: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  }

  // 纯数字
  if (/^\d+$/.test(str)) {
    return parseInt(str, 10)
  }

  // 中文数字
  if (str.length === 1) {
    return chineseNums[str] || 1
  }

  // 十几、二十几等
  if (str.startsWith('十')) {
    return 10 + (chineseNums[str[1]] || 0)
  }
  if (str.endsWith('十')) {
    return (chineseNums[str[0]] || 1) * 10
  }

  return chineseNums[str] || 1
}

/**
 * 生成文档结构的简洁描述（用于发送给 AI）
 */
export function getDocumentSummary(structure: DocumentStructure): string {
  const lines: string[] = []

  structure.blocks.forEach((block, i) => {
    const typeLabel = getTypeLabel(block.type, block.level)
    const preview = block.content.slice(0, 50) + (block.content.length > 50 ? '...' : '')
    lines.push(`[${block.id}] ${typeLabel}: "${preview}"`)
  })

  return lines.join('\n')
}

function getTypeLabel(type: string, level?: number): string {
  const labels: Record<string, string> = {
    paragraph: '段落',
    heading: `标题H${level || 1}`,
    bulletList: '无序列表',
    orderedList: '有序列表',
    taskList: '任务列表',
    blockquote: '引用',
    codeBlock: '代码块',
    table: '表格',
    callout: '提示框',
    collapsible: '折叠块',
  }
  return labels[type] || type
}

/**
 * 编辑命令类型
 */
export interface EditCommand {
  action: 'replace' | 'insert_after' | 'insert_before' | 'delete' | 'replace_all'
  targetId: string           // 目标块 ID (replace_all 时可为 'document')
  targetRef?: string         // 原始自然语言引用
  newContent?: string        // 新内容 (replace/insert 时需要)
  explanation?: string       // AI 对修改的解释
}

/**
 * 将内容转换为编辑器可用的 HTML
 */
function prepareContent(content: string): string {
  const { html } = smartConvert(content)
  return sanitizeHtml(html)
}

/**
 * 应用编辑命令到编辑器
 */
export function applyEditCommand(
  editor: Editor,
  command: EditCommand,
  structure: DocumentStructure
): boolean {
  // 全文替换特殊处理
  if (command.action === 'replace_all') {
    if (!command.newContent) return false
    const html = prepareContent(command.newContent)
    editor.chain().focus().clearContent().insertContent(html).run()
    return true
  }

  const targetBlock = structure.blocks.find(b => b.id === command.targetId)
  if (!targetBlock) {
    console.error('[document-parser] Target block not found:', command.targetId)
    return false
  }

  const { from, to } = targetBlock

  switch (command.action) {
    case 'replace':
      if (!command.newContent) return false
      const replaceHtml = prepareContent(command.newContent)
      editor
        .chain()
        .focus()
        .setTextSelection({ from: from + 1, to: to - 1 })
        .deleteSelection()
        .insertContent(replaceHtml)
        .run()
      return true

    case 'delete':
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .deleteSelection()
        .run()
      return true

    case 'insert_after':
      if (!command.newContent) return false
      const afterHtml = prepareContent(command.newContent)
      editor
        .chain()
        .focus()
        .setTextSelection({ from: to, to: to })
        .insertContent(afterHtml)
        .run()
      return true

    case 'insert_before':
      if (!command.newContent) return false
      const beforeHtml = prepareContent(command.newContent)
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to: from })
        .insertContent(beforeHtml)
        .run()
      return true

    default:
      return false
  }
}

/**
 * 批量应用多个编辑命令
 */
export function applyEditCommands(
  editor: Editor,
  commands: EditCommand[],
  structure: DocumentStructure
): { success: number; failed: number } {
  let success = 0
  let failed = 0

  // 从后往前应用，避免位置偏移问题
  const sortedCommands = [...commands].sort((a, b) => {
    const blockA = structure.blocks.find(bl => bl.id === a.targetId)
    const blockB = structure.blocks.find(bl => bl.id === b.targetId)
    return (blockB?.from || 0) - (blockA?.from || 0)
  })

  for (const command of sortedCommands) {
    if (applyEditCommand(editor, command, structure)) {
      success++
    } else {
      failed++
    }
  }

  return { success, failed }
}

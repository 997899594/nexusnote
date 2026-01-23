'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Editor } from '@tiptap/react'
import {
  parseDocument,
  getDocumentSummary,
  applyEditCommand,
  applyEditCommands,
  resolveBlockReference,
  type DocumentStructure,
  type DocumentBlock,
  type EditCommand,
} from '@/lib/document-parser'

interface EditorContextValue {
  editor: Editor | null
  setEditor: (editor: Editor | null) => void
  getDocumentContent: () => string
  getDocumentJSON: () => any
  // Phase 2: 文档编辑
  getDocumentStructure: () => DocumentStructure | null
  getDocumentSummary: () => string
  resolveBlockRef: (reference: string) => DocumentBlock | null
  applyEdit: (command: EditCommand) => boolean
  applyEdits: (commands: EditCommand[]) => { success: number; failed: number }
  highlightBlock: (blockId: string) => void
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({ children }: { children: ReactNode }) {
  const [editor, setEditor] = useState<Editor | null>(null)

  const getDocumentContent = useCallback(() => {
    return editor?.getText() || ''
  }, [editor])

  const getDocumentJSON = useCallback(() => {
    return editor?.getJSON() || null
  }, [editor])

  // Phase 2: 文档结构解析
  const getDocumentStructure = useCallback(() => {
    if (!editor) return null
    return parseDocument(editor)
  }, [editor])

  const getDocumentSummaryFn = useCallback(() => {
    if (!editor) return ''
    const structure = parseDocument(editor)
    return getDocumentSummary(structure)
  }, [editor])

  const resolveBlockRef = useCallback((reference: string) => {
    if (!editor) return null
    const structure = parseDocument(editor)
    return resolveBlockReference(reference, structure)
  }, [editor])

  const applyEdit = useCallback((command: EditCommand) => {
    if (!editor) return false
    const structure = parseDocument(editor)
    return applyEditCommand(editor, command, structure)
  }, [editor])

  const applyEdits = useCallback((commands: EditCommand[]) => {
    if (!editor) return { success: 0, failed: commands.length }
    const structure = parseDocument(editor)
    return applyEditCommands(editor, commands, structure)
  }, [editor])

  // 高亮指定块（用于预览）
  const highlightBlock = useCallback((blockId: string) => {
    if (!editor) return
    const structure = parseDocument(editor)
    const block = structure.blocks.find((b: DocumentBlock) => b.id === blockId)
    if (block) {
      editor.chain().focus().setTextSelection({ from: block.from + 1, to: block.to - 1 }).run()
    }
  }, [editor])

  return (
    <EditorContext.Provider value={{
      editor,
      setEditor,
      getDocumentContent,
      getDocumentJSON,
      getDocumentStructure,
      getDocumentSummary: getDocumentSummaryFn,
      resolveBlockRef,
      applyEdit,
      applyEdits,
      highlightBlock,
    }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditorContext() {
  const context = useContext(EditorContext)
  return context // 可能为 null，调用方需要检查
}

export function useEditorContextRequired() {
  const context = useContext(EditorContext)
  if (!context) {
    throw new Error('useEditorContextRequired must be used within EditorProvider')
  }
  return context
}

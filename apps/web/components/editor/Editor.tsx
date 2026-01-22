'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Image } from '@tiptap/extension-image'
import { Youtube } from '@tiptap/extension-youtube'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Dropcursor } from '@tiptap/extension-dropcursor'
import { Gapcursor } from '@tiptap/extension-gapcursor'
import { useMemo, useEffect, useState, useCallback, useContext } from 'react'
import { useEditorContext } from '@/contexts/EditorContext'
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { HocuspocusProvider } from '@hocuspocus/provider'
import { getRandomColor, getRandomUserName } from '@/lib/collaboration'
import { Wifi, WifiOff, Users } from 'lucide-react'
import { EditorToolbar } from './EditorToolbar'
import { AIBubbleMenu } from './AIBubbleMenu'
import { TableMenu } from './TableMenu'
import { SlashCommand } from './SlashCommand'
import { Callout } from './extensions/callout'
import { Collapsible } from './extensions/collapsible'

interface EditorProps {
  documentId: string
  showToolbar?: boolean
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export function Editor({ documentId, showToolbar = true }: EditorProps) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [collaborators, setCollaborators] = useState<Array<{ name: string; color: string }>>([])
  const editorContext = useEditorContext() // 可能为 null

  // 创建 Yjs 文档
  const ydoc = useMemo(() => new Y.Doc(), [])

  // 当前用户信息（实际项目从 Auth 获取）
  const currentUser = useMemo(() => ({
    id: `user-${Math.random().toString(36).slice(2, 9)}`,
    name: getRandomUserName(),
    color: getRandomColor(),
  }), [])

  // Hocuspocus Provider
  const provider = useMemo(() => {
    const collabUrl = process.env.NEXT_PUBLIC_COLLAB_URL || 'ws://localhost:1234'

    return new HocuspocusProvider({
      url: collabUrl,
      name: documentId,
      document: ydoc,
      token: 'dev-token', // Phase 2+: 从 Auth 获取 JWT

      onConnect() {
        setStatus('connected')
      },

      onDisconnect() {
        setStatus('disconnected')
      },

      onSynced() {
        console.log('[Editor] Document synced with server')
      },

      onAuthenticationFailed() {
        console.error('[Editor] Auth failed')
        setStatus('disconnected')
      },
    })
  }, [documentId, ydoc])

  // 设置用户 Awareness
  useEffect(() => {
    provider.setAwarenessField('user', currentUser)

    // 监听协作者变化
    const updateCollaborators = () => {
      const states = provider.awareness?.getStates()
      if (!states) return

      const users: Array<{ name: string; color: string }> = []
      states.forEach((state, clientId) => {
        if (clientId !== provider.awareness?.clientID && state.user) {
          users.push(state.user)
        }
      })
      setCollaborators(users)
    }

    provider.awareness?.on('change', updateCollaborators)
    updateCollaborators()

    return () => {
      provider.awareness?.off('change', updateCollaborators)
    }
  }, [provider, currentUser])

  // IndexedDB 持久化（离线支持）
  useEffect(() => {
    const persistence = new IndexeddbPersistence(documentId, ydoc)

    persistence.on('synced', () => {
      console.log('[Editor] Content loaded from IndexedDB')
    })

    return () => {
      persistence.destroy()
    }
  }, [documentId, ydoc])

  // 清理 Provider
  useEffect(() => {
    return () => {
      provider.destroy()
    }
  }, [provider])

  // 初始化编辑器
  const editor = useEditor({
    immediatelyRender: false, // TipTap 3.x: 避免 SSR 水合不匹配
    extensions: [
      StarterKit.configure({
        // TipTap 3.x: history 已从 StarterKit 移除，使用 Collaboration 时自动禁用
      }),
      Placeholder.configure({
        placeholder: 'Start writing, or press / for commands...',
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: currentUser,
      }),
      SlashCommand,

      // 拖拽和光标
      Dropcursor.configure({
        color: 'hsl(var(--primary))',
        width: 2,
      }),
      Gapcursor,

      // Task List
      TaskList,
      TaskItem.configure({
        nested: true,
      }),

      // Table
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'editor-table',
        },
      }),
      TableRow,
      TableCell,
      TableHeader,

      // Media
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'editor-image',
        },
      }),
      Youtube.configure({
        HTMLAttributes: {
          class: 'editor-youtube',
        },
      }),

      // Custom Extensions
      Callout,
      Collapsible,
    ],
    editorProps: {
      attributes: {
        class: 'tiptap prose prose-sm sm:prose lg:prose-lg focus:outline-none min-h-[500px]',
      },
    },
  })

  // 注册 editor 到 Context（供 ChatSidebar 等组件使用）
  useEffect(() => {
    if (editorContext && editor) {
      console.log('[Editor] Registering editor to context')
      editorContext.setEditor(editor)
    }
    return () => {
      if (editorContext) {
        console.log('[Editor] Unregistering editor from context')
        editorContext.setEditor(null)
      }
    }
  }, [editor, editorContext])

  if (!editor) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3 mb-4" />
        <div className="h-4 bg-muted rounded w-full mb-2" />
        <div className="h-4 bg-muted rounded w-2/3" />
      </div>
    )
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toolbar */}
      {showToolbar && <EditorToolbar editor={editor} />}

      {/* Editor Content */}
      <div className="p-4">
        <EditorContent editor={editor} />

        {/* AI Bubble Menu */}
        <AIBubbleMenu editor={editor} />

        {/* Table Menu */}
        <TableMenu editor={editor} />
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-4">
          {/* Character Count */}
          <span>
            {editor.getText().length} characters
          </span>

          {/* Connection Status */}
          <span className="flex items-center gap-1">
            {status === 'connected' ? (
              <>
                <Wifi className="w-3 h-3 text-green-500" />
                <span className="text-green-600">Connected</span>
              </>
            ) : status === 'connecting' ? (
              <>
                <Wifi className="w-3 h-3 text-yellow-500 animate-pulse" />
                <span className="text-yellow-600">Connecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-500" />
                <span className="text-red-600">Offline</span>
              </>
            )}
          </span>

          {/* Local Save Status */}
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Saved locally
          </span>
        </div>

        {/* Collaborators */}
        {collaborators.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3" />
            <div className="flex -space-x-2">
              {collaborators.slice(0, 5).map((user, i) => (
                <div
                  key={i}
                  className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-medium text-white"
                  style={{ backgroundColor: user.color }}
                  title={user.name}
                >
                  {user.name.charAt(0)}
                </div>
              ))}
              {collaborators.length > 5 && (
                <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px]">
                  +{collaborators.length - 5}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

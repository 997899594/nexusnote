"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import { clientEnv } from "@nexusnote/config";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { Dropcursor } from "@tiptap/extension-dropcursor";
import { Gapcursor } from "@tiptap/extension-gapcursor";
import { Image } from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import { Youtube } from "@tiptap/extension-youtube";
import { EditorContent, useEditor as useTiptapEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Edit3, History, Lock, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { Component, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { getDocumentAction, updateDocumentAction } from "@/app/actions/document";
import { TimelinePanel, useTimeline } from "@/components/timeline";
import { getAuthToken } from "@/lib/auth-helpers";
import { getRandomColor, getRandomUserName } from "@/lib/editor/collaboration";
import { type DocumentSnapshot, snapshotStore } from "@/lib/storage";
import { useEditor } from "@/lib/store";
import { AIBubbleMenu } from "./AIBubbleMenu";
import { EditorToolbar } from "./EditorToolbar";
import { Callout } from "./extensions/callout";
import { Collapsible } from "./extensions/collapsible";
import { GhostBrain } from "./GhostBrain";
import { SlashCommand } from "./SlashCommand";
import { TableMenu } from "./TableMenu";

/**
 * Error Boundary for Editor - 捕获编辑器初始化错误并提供恢复选项
 */
interface EditorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class EditorErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  EditorErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onRetry: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): EditorErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[Editor] Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-muted-foreground">
          <p className="text-sm">编辑器加载失败</p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onRetry();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90"
          >
            <RefreshCw className="w-4 h-4" />
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const COLLAB_URL = clientEnv.NEXT_PUBLIC_COLLAB_URL;

interface EditorProps {
  documentId: string;
  showToolbar?: boolean;
  isVault?: boolean;
  setIsVault?: (v: boolean) => void;
  title?: string;
  setTitle?: (t: string) => void;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected";

/**
 * 内部 Editor 组件 - 只有当 provider 就绪时才渲染
 * 这样可以避免 useEditor 依赖项变化导致的重建问题
 */
function EditorInner({
  documentId,
  ydoc,
  provider,
  currentUser,
  showToolbar,
  isVault,
  setIsVault,
  title,
  status,
  collaborators,
}: {
  documentId: string;
  ydoc: Y.Doc;
  provider: HocuspocusProvider;
  currentUser: {
    id: string;
    name: string;
    color: string;
    image?: string | null;
  };
  showToolbar: boolean;
  isVault: boolean;
  setIsVault?: (v: boolean) => void;
  title: string;
  status: ConnectionStatus;
  collaborators: Array<{ name: string; color: string }>;
}) {
  const { setEditor } = useEditor();
  const [showTimeline, setShowTimeline] = useState(false);

  const toggleVault = async () => {
    const nextValue = !isVault;
    try {
      const result = await updateDocumentAction({
        documentId,
        isVault: nextValue,
      });
      if (result.success) setIsVault?.(nextValue);
    } catch (_err) {}
  };

  // Extensions 稳定化 - 只在 provider 和 ydoc 不变时保持稳定
  const extensions = useMemo(
    () => [
      StarterKit,
      Placeholder.configure({ placeholder: "开始记笔记..." }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({ provider, user: currentUser }),
      SlashCommand,
      Dropcursor.configure({ color: "hsl(var(--primary))", width: 2 }),
      Gapcursor,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ allowBase64: true }),
      Youtube.configure({}),
      Callout,
      Collapsible,
    ],
    [ydoc, provider, currentUser],
  );

  // Editor - 使用稳定的配置
  const editor = useTiptapEditor(
    {
      immediatelyRender: false,
      extensions,
      editorProps: {
        attributes: {
          class:
            "tiptap prose prose-sm sm:prose lg:prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[70vh] pb-64 leading-relaxed",
        },
      },
    },
    [extensions],
  );

  // Sync editor to context
  useEffect(() => {
    if (setEditor && editor) setEditor(editor);
    return () => {
      if (setEditor) setEditor(null);
    };
  }, [editor, setEditor]);

  // Timeline
  const { stats } = useTimeline({ documentId, ydoc, enabled: true });
  const handleRestoreSnapshot = useCallback(
    async (s: DocumentSnapshot) => {
      if (await snapshotStore.restoreSnapshot(s.id, ydoc)) console.log("Restored");
    },
    [ydoc],
  );

  // Loading state
  if (!editor || !editor.state) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded-xl w-1/4" />
        <div className="h-64 bg-muted rounded-2xl w-full" />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col">
      {/* Normalized Header - More Exquisite */}
      <div className="mb-12">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-white shadow-2xl shadow-black/20 group hover:scale-105 transition-transform duration-500">
              <Edit3 className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black/30 leading-none">
                  Drafting Note
                </span>
                {isVault && (
                  <div className="px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-600 text-[8px] font-black flex items-center gap-1 uppercase tracking-widest border border-violet-500/5">
                    <Lock className="w-2.5 h-2.5" /> Private Vault
                  </div>
                )}
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-black leading-tight">
                {title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {collaborators.length > 0 && (
              <div className="flex items-center px-4 py-2 bg-black/[0.02] border border-black/[0.04] rounded-2xl gap-3">
                <div className="flex items-center -space-x-2">
                  {collaborators.slice(0, 3).map((u, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full border-2 border-white shadow-sm ring-1 ring-black/5"
                      style={{ backgroundColor: u.color }}
                      title={u.name}
                    />
                  ))}
                  {collaborators.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-white border border-black/5 flex items-center justify-center text-[8px] font-black">
                      +{collaborators.length - 3}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-black/40">
                  Collaborating
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2.5">
            {status === "connected" ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 rounded-full border border-emerald-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-emerald-600">Synced Live</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/5 rounded-full border border-rose-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                <span className="text-rose-600">Offline Mode</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-black/40">
            <RefreshCw className="w-3.5 h-3.5 opacity-40" />
            <span>{editor.getText().length} Characters</span>
          </div>

          <div className="flex-1 h-px bg-black/[0.03]" />
        </div>
      </div>

      {/* Toolbar - Floating & Glassy */}
      {showToolbar && (
        <div className="mb-12 sticky top-6 z-40 transition-all flex justify-center">
          <div className="bg-white/70 backdrop-blur-3xl p-2 rounded-[28px] inline-flex border border-black/[0.03] shadow-2xl shadow-black/5 ring-1 ring-black/[0.02]">
            <EditorToolbar editor={editor} isVault={isVault} onToggleVault={toggleVault} />
          </div>
        </div>
      )}

      {/* Content - Pure & Focused */}
      <div className="relative z-10 max-w-4xl mx-auto w-full">
        <EditorContent editor={editor} />
        <AIBubbleMenu editor={editor} documentId={documentId} />
        <TableMenu editor={editor} />
      </div>

      {/* Timeline Toggle - More Discrete */}
      <div className="fixed bottom-10 right-10 z-[100]">
        <button
          onClick={() => setShowTimeline(true)}
          className="w-14 h-14 bg-white/60 backdrop-blur-3xl rounded-[24px] flex items-center justify-center border border-black/[0.04] text-black/30 hover:text-black hover:bg-white hover:border-black/10 transition-all hover:scale-110 shadow-2xl shadow-black/5 group"
          title="View Version History"
        >
          <History className="w-6 h-6 group-hover:rotate-[-10deg] transition-transform" />
        </button>
      </div>

      <TimelinePanel
        documentId={documentId}
        ydoc={ydoc}
        isOpen={showTimeline}
        onClose={() => setShowTimeline(false)}
        onRestore={handleRestoreSnapshot}
      />

      <GhostBrain editor={editor} documentId={documentId} title={title} />
    </div>
  );
}

/**
 * 外层 Editor 组件 - 负责初始化 ydoc、provider 等基础设施
 */
export function Editor({
  documentId,
  showToolbar = true,
  isVault = false,
  setIsVault,
  title = "无标题文档",
  setTitle,
}: EditorProps) {
  const { data: session } = useSession();
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [collaborators, setCollaborators] = useState<Array<{ name: string; color: string }>>([]);
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [isProviderSynced, setIsProviderSynced] = useState(false);

  // Fetch document metadata
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const result = await getDocumentAction(documentId);
        // 2026 架构师标准：使用类型收窄处理标准 ActionResult
        if (result.success) {
          const doc = result.data;
          setIsVault?.(doc.isVault);
          setTitle?.(doc.title);
        } else {
          console.error(`[Editor] Failed to fetch metadata: ${result.error}`);
        }
      } catch (err) {
        console.error("[Editor] Unexpected error:", err);
      }
    };
    fetchMetadata();
  }, [documentId, setIsVault, setTitle]);

  // Y.Doc - stable across renders
  // 注意：不要手动调用 getXmlFragment，让 Collaboration 扩展自己处理
  const ydoc = useMemo(() => new Y.Doc(), []);

  // Current user - stable across renders (只依赖 session.user.id)
  const currentUser = useMemo(() => {
    if (session?.user) {
      return {
        id: session.user.id || `u-${Math.random()}`,
        name: session.user.name || "Anonymous",
        color: getRandomColor(),
        image: session.user.image,
      };
    }
    return {
      id: `u-${Math.random()}`,
      name: getRandomUserName(),
      color: getRandomColor(),
    };
  }, [session?.user?.id, session?.user?.name, session?.user?.image, session?.user]);

  // HocuspocusProvider - created in useEffect
  useEffect(() => {
    setIsProviderSynced(false);

    const p = new HocuspocusProvider({
      url: COLLAB_URL,
      name: documentId,
      document: ydoc,
      token: (session as { accessToken?: string } | null)?.accessToken || getAuthToken(),
      onConnect() {
        setStatus("connected");
      },
      onDisconnect() {
        setStatus("disconnected");
      },
      onSynced() {
        // 确保 provider 完全同步后再标记就绪
        setIsProviderSynced(true);
      },
    });
    setProvider(p);

    return () => {
      p.destroy();
      setProvider(null);
      setIsProviderSynced(false);
    };
  }, [documentId, ydoc, session]);

  // Collaborators awareness
  useEffect(() => {
    if (!provider || !currentUser) return;

    provider.setAwarenessField("user", currentUser);

    const updateCollaborators = () => {
      const states = provider.awareness?.getStates();
      if (!states) return;
      const users: Array<{ name: string; color: string }> = [];
      states.forEach((state, cli) => {
        if (cli !== provider.awareness?.clientID && state.user)
          users.push(state.user as { name: string; color: string });
      });
      setCollaborators(users);
    };

    provider.awareness?.on("change", updateCollaborators);
    return () => {
      provider.awareness?.off("change", updateCollaborators);
    };
  }, [provider, currentUser]);

  // IndexedDB persistence
  useEffect(() => {
    const persistence = new IndexeddbPersistence(documentId, ydoc);
    return () => {
      persistence.destroy();
    };
  }, [documentId, ydoc]);

  // 等待 provider 就绪且同步完成后再渲染 EditorInner
  if (!provider || !isProviderSynced) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded-xl w-1/4" />
        <div className="h-64 bg-muted rounded-2xl w-full" />
      </div>
    );
  }

  // 用 key 强制完全重新挂载，避免状态不一致
  const editorKey = `${documentId}-${COLLAB_URL}`;

  return (
    <EditorInner
      key={editorKey}
      documentId={documentId}
      ydoc={ydoc}
      provider={provider}
      currentUser={currentUser}
      showToolbar={showToolbar}
      isVault={isVault}
      setIsVault={setIsVault}
      title={title}
      status={status}
      collaborators={collaborators}
    />
  );
}

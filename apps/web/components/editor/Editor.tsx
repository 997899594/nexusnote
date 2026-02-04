"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { clientEnv } from "@nexusnote/config";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { Image } from "@tiptap/extension-image";
import { Youtube } from "@tiptap/extension-youtube";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Dropcursor } from "@tiptap/extension-dropcursor";
import { Gapcursor } from "@tiptap/extension-gapcursor";
import { useSession } from "next-auth/react";
import { useMemo, useEffect, useState, useCallback } from "react";
import { useEditorContext } from "@/contexts/EditorContext";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { getRandomColor, getRandomUserName } from "@/lib/editor/collaboration";
import { getAuthToken } from "@/lib/auth-helpers";
import { Wifi, WifiOff, Users, History, Lock, Edit3 } from "lucide-react";
import { EditorToolbar } from "./EditorToolbar";
import { AIBubbleMenu } from "./AIBubbleMenu";
import { TableMenu } from "./TableMenu";
import { SlashCommand } from "./SlashCommand";
import { GhostBrain } from "./GhostBrain";
import { Callout } from "./extensions/callout";
import { Collapsible } from "./extensions/collapsible";
import {
  TimelinePanel,
  useTimeline,
  useAIEditSnapshot,
} from "@/components/timeline";
import { snapshotStore, DocumentSnapshot } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";

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
  const [collaborators, setCollaborators] = useState<
    Array<{ name: string; color: string }>
  >([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const editorContext = useEditorContext();

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const res = await fetch(
          `${clientEnv.NEXT_PUBLIC_API_URL}/documents/${documentId}`,
        );
        if (res.ok) {
          const doc = await res.json();
          setIsVault?.(doc.isVault || false);
          setTitle?.(doc.title || "无标题文档");
        }
      } catch (err) {}
    };
    fetchMetadata();
  }, [documentId, setIsVault, setTitle]);

  const toggleVault = async () => {
    const nextValue = !isVault;
    try {
      const res = await fetch(
        `${clientEnv.NEXT_PUBLIC_API_URL}/documents/${documentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isVault: nextValue }),
        },
      );
      if (res.ok) setIsVault?.(nextValue);
    } catch (err) {}
  };

  const ydoc = useMemo(() => {
    const doc = new Y.Doc();
    // Initialize the fragment that Tiptap Collaboration will use
    doc.getXmlFragment('default');
    return doc;
  }, []);

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
  }, [session]);

  const provider = useMemo(() => {
    const p = new HocuspocusProvider({
      url: COLLAB_URL,
      name: documentId,
      document: ydoc,
      token: (session as any)?.accessToken || getAuthToken(),
      onConnect() {
        setStatus("connected");
      },
      onDisconnect() {
        setStatus("disconnected");
      },
    });
    return p;
  }, [documentId, ydoc, session]);

  useEffect(() => {
    if (!currentUser) return;
    provider.setAwarenessField("user", currentUser);
    const updateCollaborators = () => {
      const states = provider.awareness?.getStates();
      if (!states) return;
      const users: any[] = [];
      states.forEach((state, cli) => {
        if (cli !== provider.awareness?.clientID && state.user)
          users.push(state.user);
      });
      setCollaborators(users);
    };
    provider.awareness?.on("change", updateCollaborators);
    return () => {
      provider.awareness?.off("change", updateCollaborators);
    };
  }, [provider, currentUser]);

  useEffect(() => {
    const persistence = new IndexeddbPersistence(documentId, ydoc);
    return () => {
      persistence.destroy();
    };
  }, [documentId, ydoc]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
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
      editorProps: {
        attributes: {
          class:
            "tiptap prose prose-sm sm:prose lg:prose-neutral dark:prose-invert max-w-none focus:outline-none min-h-[70vh] pb-64 leading-relaxed",
        },
      },
    },
    [ydoc, provider, currentUser]
  );

  useEffect(() => {
    if (editorContext && editor) editorContext.setEditor(editor);
    return () => {
      if (editorContext) editorContext.setEditor(null);
    };
  }, [editor, editorContext]);

  const { stats } = useTimeline({ documentId, ydoc, enabled: true });
  const handleRestoreSnapshot = useCallback(
    async (s: DocumentSnapshot) => {
      if (await snapshotStore.restoreSnapshot(s.id, ydoc))
        console.log("Restored");
    },
    [ydoc],
  );

  if (!editor)
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-muted rounded-xl w-1/4" />
        <div className="h-64 bg-muted rounded-2xl w-full" />
      </div>
    );

  return (
    <div className="relative flex flex-col">
      {/* Normalized Header */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <Edit3 className="w-4 h-4 text-muted-foreground/40" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/30">
            笔记编辑
          </span>
          {isVault && (
            <div className="px-2 py-0.5 rounded-lg bg-violet-500/10 text-violet-500 text-[10px] font-bold flex items-center gap-1.5 uppercase tracking-wider border border-violet-500/10">
              <Lock className="w-3 h-3" /> 已加密
            </div>
          )}
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-4 text-foreground/90 uppercase">
          {title}
        </h1>

        <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
          <div className="flex items-center gap-2">
            {status === "connected" ? (
              <Wifi className="w-3 h-3 text-emerald-500/50" />
            ) : (
              <WifiOff className="w-3 h-3 text-rose-500/50" />
            )}
            {status === "connected" ? "云端已同步" : "离线模式"}
          </div>
          <div>{editor.getText().length} 字符</div>
          {collaborators.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3" />
              <div className="flex items-center -space-x-1.5">
                {collaborators.slice(0, 3).map((u, i) => (
                  <div
                    key={i}
                    className="w-4 h-4 rounded-full border border-background shadow-sm"
                    style={{ backgroundColor: u.color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      {showToolbar && (
        <div className="mb-8 sticky top-20 z-40 transition-all">
          <div className="bg-white/80 dark:bg-black/40 backdrop-blur-3xl p-1 rounded-2xl inline-flex border border-white/10 shadow-sm">
            <EditorToolbar
              editor={editor}
              isVault={isVault}
              onToggleVault={toggleVault}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        <EditorContent editor={editor} />
        {editor && <AIBubbleMenu editor={editor} documentId={documentId} />}
        {editor && <TableMenu editor={editor} />}
      </div>

      {/* Timeline Toggle */}
      <div className="fixed bottom-32 right-12 z-[100]">
        <button
          onClick={() => setShowTimeline(true)}
          className="w-12 h-12 bg-white/10 dark:bg-black/20 backdrop-blur-3xl rounded-2xl flex items-center justify-center border border-white/10 text-muted-foreground hover:text-primary transition-all hover:scale-105"
        >
          <History className="w-5 h-5" />
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

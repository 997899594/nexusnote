/**
 * Collaboration - 2026 最现代化方案
 * PartyKit + Yjs + Tiptap 3.x Cursor
 */

"use client";

import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useState } from "react";
import YPartyKitProvider from "y-partykit/provider";
import * as Y from "yjs";

export interface CollaborationConfig {
  documentId: string;
  host?: string;
  user?: { id: string; name: string; color: string };
}

interface Props {
  config: CollaborationConfig;
  content?: string;
  onChange?: (html: string) => void;
  editable?: boolean;
}

const DEFAULT_HOST = process.env.NEXT_PUBLIC_PARTYKIT_HOST || "localhost:1999";

export function CollaborationEditor({ config, content = "", onChange, editable = true }: Props) {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [users, setUsers] = useState<Array<{ name: string; color: string }>>([]);
  const { documentId, host = DEFAULT_HOST, user } = config;
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);

  const provider = useMemo(() => {
    const protocol = host.startsWith("localhost") ? "ws" : "wss";
    const yProvider = new YPartyKitProvider(`${protocol}://${host}`, documentId, ydoc);
    yProvider.on("status", (e: { status: string }) => setStatus(e.status as any));
    if (yProvider.awareness) {
      yProvider.awareness.on("change", () => {
        const list: Array<{ name: string; color: string }> = [];
        yProvider.awareness!.getStates().forEach((s: any) => {
          if (s.user) list.push(s.user);
        });
        setUsers(list);
      });
    }
    return yProvider;
  }, [documentId, host, ydoc]);

  useEffect(() => {
    if (user && provider.awareness)
      provider.awareness.setLocalStateField("user", { name: user.name, color: user.color });
  }, [provider, user]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider,
        user: user ? { name: user.name, color: user.color } : undefined,
      }),
    ],
    content: content || undefined,
    editable,
    onUpdate: ({ editor: ed }: { editor: any }) => onChange?.(ed.getHTML()),
    editorProps: { attributes: { class: "prose focus:outline-none min-h-[200px] p-4" } },
  });

  useEffect(
    () => () => {
      provider.destroy();
      ydoc.destroy();
    },
    [provider, ydoc],
  );

  if (!editor) return null;

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 12px",
          background: "rgba(0,0,0,0.7)",
          borderRadius: 20,
          fontSize: 12,
          color: "white",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background:
              status === "connected" ? "#22c55e" : status === "connecting" ? "#f59e0b" : "#ef4444",
          }}
        />
        <span>
          {status === "connected"
            ? `${users.length} 在线`
            : status === "connecting"
              ? "连接中..."
              : "离线"}
        </span>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export function createDocumentId(userId: string) {
  return `nexusnote-${userId}-${Date.now()}`;
}
export function getRandomColor(id: string) {
  const colors = [
    "#f783ac",
    "#9f7aea",
    "#667eea",
    "#4299e1",
    "#38b2ac",
    "#48bb78",
    "#68d391",
    "#ecc94b",
    "#ed8936",
    "#fc8181",
    "#f56565",
    "#e53e3e",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}
export default CollaborationEditor;

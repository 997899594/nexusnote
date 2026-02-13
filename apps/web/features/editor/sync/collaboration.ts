import { HocuspocusProvider } from "@hocuspocus/provider";
import { clientEnv } from "@nexusnote/config";
import type { CollaborationUser } from "@nexusnote/types";
import type * as Y from "yjs";
import { getAuthToken } from "@/lib/auth-helpers";

// Re-export type for backward compatibility
export type { CollaborationUser };

export interface CreateProviderOptions {
  documentId: string;
  ydoc: Y.Doc;
  token?: string;
  user: CollaborationUser;
  onSynced?: () => void;
  onDisconnect?: () => void;
  onAuthenticationFailed?: () => void;
}

export function createCollaborationProvider({
  documentId,
  ydoc,
  token,
  user,
  onSynced,
  onDisconnect,
  onAuthenticationFailed,
}: CreateProviderOptions): HocuspocusProvider {
  const provider = new HocuspocusProvider({
    url: clientEnv.NEXT_PUBLIC_COLLAB_URL,
    name: documentId,
    document: ydoc,
    token: token || getAuthToken(),

    onSynced() {
      console.log("[Collab] Document synced with server");
      onSynced?.();
    },

    onDisconnect() {
      console.log("[Collab] Disconnected from server");
      onDisconnect?.();
    },

    onAuthenticationFailed() {
      console.error("[Collab] Authentication failed");
      onAuthenticationFailed?.();
    },

    onConnect() {
      console.log("[Collab] Connected to server");
    },

    onClose() {
      console.log("[Collab] Connection closed");
    },
  });

  // 设置用户 Awareness 信息
  provider.setAwarenessField("user", user);

  return provider;
}

// 生成随机颜色
export function getRandomColor(): string {
  const colors = [
    "#ff6b6b",
    "#4ecdc4",
    "#45b7d1",
    "#96ceb4",
    "#ffeaa7",
    "#fd79a8",
    "#a29bfe",
    "#00b894",
    "#e17055",
    "#0984e3",
    "#6c5ce7",
    "#fdcb6e",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// 生成随机用户名（开发用）
export function getRandomUserName(): string {
  const adjectives = ["Happy", "Clever", "Brave", "Swift", "Calm"];
  const nouns = ["Panda", "Eagle", "Tiger", "Dolphin", "Fox"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

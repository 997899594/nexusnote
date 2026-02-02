/**
 * Sync Engine - 本地优先同步引擎
 *
 * 核心原则：
 * 1. 本地始终可用 - 无网络时完整功能
 * 2. 后台同步 - 有网络时自动同步到服务器
 * 3. CRDT 合并 - Yjs 自动解决冲突，无需手动处理
 * 4. 增量同步 - 只传输差异，节省带宽
 */

import * as Y from "yjs";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { documentStore } from "./document-store";
import { snapshotStore } from "./snapshot-store";
import { localDb, STORES, SyncState } from "./local-db";
import { clientEnv } from "@nexusnote/config";
import { getAuthToken } from "../auth-helpers";

type SyncStatus = "idle" | "syncing" | "offline" | "error";
type ConnectionState = "connected" | "connecting" | "disconnected";

interface SyncEvent {
  type:
    | "sync_start"
    | "sync_complete"
    | "sync_error"
    | "conflict_resolved"
    | "offline"
    | "online";
  documentId?: string;
  error?: Error;
}

type SyncEventListener = (event: SyncEvent) => void;

export class SyncEngine {
  private providers: Map<string, HocuspocusProvider> = new Map();
  private ydocs: Map<string, Y.Doc> = new Map();
  private status: SyncStatus = "idle";
  private connectionState: ConnectionState = "disconnected";
  private listeners: Set<SyncEventListener> = new Set();
  private syncQueue: Set<string> = new Set();
  private isSyncing = false;

  constructor() {
    // 监听网络状态
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleOnline());
      window.addEventListener("offline", () => this.handleOffline());
    }
  }

  /**
   * 连接到文档（本地优先）
   */
  async connect(documentId: string): Promise<Y.Doc> {
    // 1. 先创建/获取 YDoc
    let ydoc = this.ydocs.get(documentId);
    if (!ydoc) {
      ydoc = new Y.Doc();
      this.ydocs.set(documentId, ydoc);
    }

    // 2. 从本地加载（本地优先！）
    const loaded = await documentStore.loadToYDoc(documentId, ydoc);
    if (loaded) {
      console.log(`[SyncEngine] Loaded document from local: ${documentId}`);
    } else {
      // 本地没有，创建新文档
      await documentStore.createDocument(documentId);
      console.log(`[SyncEngine] Created new local document: ${documentId}`);
    }

    // 3. 设置本地持久化（每次更新都保存到 IndexedDB）
    ydoc.on("update", async (update: Uint8Array, origin: any) => {
      // 忽略来自远程的更新（避免重复保存）
      if (origin === "remote") return;

      await documentStore.saveFromYDoc(documentId, ydoc!);
      console.log(`[SyncEngine] Saved local update: ${documentId}`);

      // 检查是否需要自动快照
      if (snapshotStore.shouldAutoSnapshot(documentId)) {
        await snapshotStore.createSnapshot(documentId, ydoc!, "auto");
      }
    });

    // 4. 尝试连接服务器（可选，后台进行）
    if (navigator.onLine) {
      this.connectToServer(documentId, ydoc);
    }

    return ydoc;
  }

  /**
   * 连接到服务器进行同步
   */
  private connectToServer(documentId: string, ydoc: Y.Doc): void {
    if (this.providers.has(documentId)) {
      return; // 已连接
    }

    const provider = new HocuspocusProvider({
      url: clientEnv.NEXT_PUBLIC_COLLAB_URL,
      name: documentId,
      document: ydoc,
      token: getAuthToken(),

      onSynced: () => {
        console.log(`[SyncEngine] Synced with server: ${documentId}`);
        this.emit({ type: "sync_complete", documentId });
        documentStore.markSynced(documentId);
      },

      onConnect: () => {
        this.connectionState = "connected";
        console.log(`[SyncEngine] Connected to server: ${documentId}`);
      },

      onDisconnect: () => {
        this.connectionState = "disconnected";
        console.log(`[SyncEngine] Disconnected from server: ${documentId}`);
      },

      onMessage: (data) => {
        // 服务器发来的更新应用到本地
        // Yjs 自动处理 CRDT 合并
      },
    });

    // 监听来自服务器的更新
    ydoc.on("update", (update: Uint8Array, origin: any) => {
      if (origin === provider) {
        // 来自服务器的更新，标记为 remote 并保存
        documentStore.saveFromYDoc(documentId, ydoc);
      }
    });

    this.providers.set(documentId, provider);
  }

  /**
   * 断开文档连接
   */
  disconnect(documentId: string): void {
    const provider = this.providers.get(documentId);
    if (provider) {
      provider.destroy();
      this.providers.delete(documentId);
    }

    // 保留 YDoc 以便后续重连
    // this.ydocs.delete(documentId)
  }

  /**
   * 获取 YDoc（如果已连接）
   */
  getYDoc(documentId: string): Y.Doc | undefined {
    return this.ydocs.get(documentId);
  }

  /**
   * 获取 Provider（如果已连接）
   */
  getProvider(documentId: string): HocuspocusProvider | undefined {
    return this.providers.get(documentId);
  }

  /**
   * 手动触发同步
   */
  async syncNow(documentId?: string): Promise<void> {
    if (!navigator.onLine) {
      console.log("[SyncEngine] Offline, skipping sync");
      return;
    }

    if (documentId) {
      await this.syncDocument(documentId);
    } else {
      // 同步所有脏文档
      const dirtyDocs = await documentStore.getDirtyDocuments();
      for (const doc of dirtyDocs) {
        await this.syncDocument(doc.id);
      }
    }
  }

  /**
   * 同步单个文档
   */
  private async syncDocument(documentId: string): Promise<void> {
    const ydoc = this.ydocs.get(documentId);
    if (!ydoc) {
      // 文档未加载，先加载
      await this.connect(documentId);
      return;
    }

    const provider = this.providers.get(documentId);
    if (!provider) {
      // 未连接服务器，尝试连接
      this.connectToServer(documentId, ydoc);
    }

    // Yjs Provider 会自动同步，这里只是确保连接存在
    this.emit({ type: "sync_start", documentId });
  }

  /**
   * 处理上线事件
   */
  private async handleOnline(): Promise<void> {
    console.log("[SyncEngine] Network online, syncing...");
    this.emit({ type: "online" });

    // 重新连接所有已断开的文档
    for (const [documentId, ydoc] of this.ydocs) {
      if (!this.providers.has(documentId)) {
        this.connectToServer(documentId, ydoc);
      }
    }

    // 同步所有脏数据
    await this.syncNow();
  }

  /**
   * 处理离线事件
   */
  private handleOffline(): void {
    console.log("[SyncEngine] Network offline");
    this.status = "offline";
    this.emit({ type: "offline" });

    // 断开所有服务器连接（但保留本地 YDoc）
    for (const [documentId, provider] of this.providers) {
      provider.disconnect();
    }
  }

  /**
   * 获取同步状态
   */
  getStatus(): {
    status: SyncStatus;
    connectionState: ConnectionState;
    connectedDocuments: string[];
    pendingSync: number;
  } {
    return {
      status: this.status,
      connectionState: this.connectionState,
      connectedDocuments: Array.from(this.providers.keys()),
      pendingSync: this.syncQueue.size,
    };
  }

  /**
   * 监听同步事件
   */
  on(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: SyncEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error("[SyncEngine] Listener error:", e);
      }
    }
  }

  /**
   * 强制全量同步（慎用）
   */
  async forceFullSync(documentId: string): Promise<void> {
    const doc = await documentStore.getDocument(documentId);
    if (!doc) return;

    // 断开并重连
    this.disconnect(documentId);

    // 创建新 YDoc
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, doc.yjsState);
    this.ydocs.set(documentId, ydoc);

    // 重新连接
    this.connectToServer(documentId, ydoc);
  }

  /**
   * 清理资源
   */
  destroy(): void {
    for (const provider of this.providers.values()) {
      provider.destroy();
    }
    this.providers.clear();
    this.ydocs.clear();
    this.listeners.clear();
  }
}

// Singleton instance
export const syncEngine = new SyncEngine();

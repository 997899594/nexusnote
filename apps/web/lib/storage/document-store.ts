/**
 * Document Store - Yjs CRDT 文档管理
 *
 * 本地优先的文档存储，使用 Yjs 实现：
 * - 离线编辑完整可用
 * - 自动冲突解决（CRDT）
 * - 增量同步（只传输差异）
 */

import * as Y from "yjs";
import { type LocalDocument, localDb, STORES } from "./local-db";

export class DocumentStore {
  /**
   * 创建新文档
   */
  async createDocument(id: string, title: string = "Untitled"): Promise<LocalDocument> {
    const ydoc = new Y.Doc();
    const now = Date.now();

    const doc: LocalDocument = {
      id,
      title,
      yjsState: Y.encodeStateAsUpdate(ydoc),
      yjsStateVector: Y.encodeStateVector(ydoc),
      plainText: "",
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
      isDirty: true,
      isDeleted: false,
    };

    await localDb.put(STORES.DOCUMENTS, doc);
    console.log("[DocumentStore] Created document:", id);
    return doc;
  }

  /**
   * 获取文档
   */
  async getDocument(id: string): Promise<LocalDocument | undefined> {
    return localDb.get<LocalDocument>(STORES.DOCUMENTS, id);
  }

  /**
   * 获取所有文档（不含已删除）
   */
  async getAllDocuments(): Promise<LocalDocument[]> {
    const docs = await localDb.getAll<LocalDocument>(STORES.DOCUMENTS);
    return docs.filter((d) => !d.isDeleted);
  }

  /**
   * 获取待同步的文档
   */
  async getDirtyDocuments(): Promise<LocalDocument[]> {
    return localDb.getAllByIndex<LocalDocument>(STORES.DOCUMENTS, "isDirty", true as any);
  }

  /**
   * 从 Yjs Doc 保存文档状态
   */
  async saveFromYDoc(id: string, ydoc: Y.Doc, title?: string): Promise<void> {
    const existing = await this.getDocument(id);
    const plainText = this.extractPlainText(ydoc);
    const now = Date.now();

    const doc: LocalDocument = {
      id,
      title: title || existing?.title || "Untitled",
      yjsState: Y.encodeStateAsUpdate(ydoc),
      yjsStateVector: Y.encodeStateVector(ydoc),
      plainText,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      syncedAt: existing?.syncedAt || null,
      isDirty: true,
      isDeleted: false,
    };

    await localDb.put(STORES.DOCUMENTS, doc);
  }

  /**
   * 加载文档到 Yjs Doc
   */
  async loadToYDoc(id: string, ydoc: Y.Doc): Promise<boolean> {
    const doc = await this.getDocument(id);
    if (!doc) return false;

    Y.applyUpdate(ydoc, doc.yjsState);
    return true;
  }

  /**
   * 应用增量更新（来自协作或同步）
   */
  async applyUpdate(id: string, update: Uint8Array): Promise<void> {
    const doc = await this.getDocument(id);
    if (!doc) {
      console.warn("[DocumentStore] Document not found for update:", id);
      return;
    }

    // 创建临时 YDoc 来合并更新
    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, doc.yjsState);
    Y.applyUpdate(ydoc, update);

    // 保存合并后的状态
    await this.saveFromYDoc(id, ydoc, doc.title);
  }

  /**
   * 计算与服务器的差异更新
   */
  async getDiffUpdate(id: string, serverStateVector: Uint8Array): Promise<Uint8Array | null> {
    const doc = await this.getDocument(id);
    if (!doc) return null;

    const ydoc = new Y.Doc();
    Y.applyUpdate(ydoc, doc.yjsState);

    // 计算服务器没有的更新
    return Y.encodeStateAsUpdate(ydoc, serverStateVector);
  }

  /**
   * 标记文档已同步
   */
  async markSynced(id: string): Promise<void> {
    const doc = await this.getDocument(id);
    if (!doc) return;

    doc.syncedAt = Date.now();
    doc.isDirty = false;
    await localDb.put(STORES.DOCUMENTS, doc);
  }

  /**
   * 软删除文档
   */
  async deleteDocument(id: string): Promise<void> {
    const doc = await this.getDocument(id);
    if (!doc) return;

    doc.isDeleted = true;
    doc.isDirty = true;
    doc.updatedAt = Date.now();
    await localDb.put(STORES.DOCUMENTS, doc);
  }

  /**
   * 硬删除文档（彻底删除）
   */
  async purgeDocument(id: string): Promise<void> {
    await localDb.delete(STORES.DOCUMENTS, id);
    // 同时删除相关快照
    const snapshots = await localDb.getAllByIndex<{ id: string }>(
      STORES.SNAPSHOTS,
      "documentId",
      id,
    );
    for (const snap of snapshots) {
      await localDb.delete(STORES.SNAPSHOTS, snap.id);
    }
  }

  /**
   * 从 Yjs Doc 提取纯文本
   */
  private extractPlainText(ydoc: Y.Doc): string {
    try {
      const content = ydoc.getXmlFragment("default");
      return this.xmlFragmentToText(content);
    } catch {
      return "";
    }
  }

  private xmlFragmentToText(fragment: Y.XmlFragment): string {
    let text = "";
    fragment.forEach((item) => {
      if (item instanceof Y.XmlText) {
        text += item.toString();
      } else if (item instanceof Y.XmlElement) {
        text += this.xmlElementToText(item);
      }
    });
    return text;
  }

  private xmlElementToText(element: Y.XmlElement): string {
    let text = "";
    element.forEach((item) => {
      if (item instanceof Y.XmlText) {
        text += item.toString();
      } else if (item instanceof Y.XmlElement) {
        text += this.xmlElementToText(item);
      }
    });
    // 块级元素后加换行
    const blockTags = ["paragraph", "heading", "blockquote", "codeBlock", "listItem"];
    if (blockTags.includes(element.nodeName)) {
      text += "\n";
    }
    return text;
  }

  /**
   * 本地搜索文档
   */
  async searchDocuments(query: string): Promise<LocalDocument[]> {
    const docs = await this.getAllDocuments();
    const lowerQuery = query.toLowerCase();

    return docs.filter(
      (doc) =>
        doc.title.toLowerCase().includes(lowerQuery) ||
        doc.plainText.toLowerCase().includes(lowerQuery),
    );
  }

  /**
   * 获取文档统计
   */
  async getStats(): Promise<{
    total: number;
    dirty: number;
    synced: number;
  }> {
    const docs = await this.getAllDocuments();
    return {
      total: docs.length,
      dirty: docs.filter((d) => d.isDirty).length,
      synced: docs.filter((d) => d.syncedAt !== null).length,
    };
  }
}

// Singleton instance
export const documentStore = new DocumentStore();

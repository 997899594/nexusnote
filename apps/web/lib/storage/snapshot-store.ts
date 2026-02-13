/**
 * Snapshot Store - 时间轴快照管理
 *
 * 功能：
 * - 自动快照（定时、AI编辑后、协作者加入）
 * - 手动快照（用户保存版本）
 * - 快照对比（Diff 计算）
 * - 版本恢复
 */

import * as Y from "yjs";
import { type DocumentSnapshot, localDb, STORES } from "@/features/shared/stores/local-db";

// 快照配置
const SNAPSHOT_CONFIG = {
  AUTO_INTERVAL: 5 * 60 * 1000, // 5分钟自动快照
  MAX_SNAPSHOTS_PER_DOC: 100, // 每文档最多保留100个快照
  MIN_CHANGE_THRESHOLD: 50, // 最小变更字符数才创建快照
};

export type SnapshotTrigger = "auto" | "manual" | "ai_edit" | "collab_join" | "restore";

export class SnapshotStore {
  private lastSnapshotTime: Map<string, number> = new Map();
  private lastSnapshotContent: Map<string, string> = new Map();

  /**
   * 创建快照
   */
  async createSnapshot(
    documentId: string,
    ydoc: Y.Doc,
    trigger: SnapshotTrigger,
    summary?: string,
  ): Promise<DocumentSnapshot | null> {
    const plainText = this.extractPlainText(ydoc);
    const wordCount = this.countWords(plainText);

    // 检查是否有足够变更（自动快照时）
    if (trigger === "auto") {
      const lastContent = this.lastSnapshotContent.get(documentId) || "";
      const changeSize = Math.abs(plainText.length - lastContent.length);
      if (changeSize < SNAPSHOT_CONFIG.MIN_CHANGE_THRESHOLD) {
        return null;
      }
    }

    // 获取上一个快照计算 diff
    const prevSnapshot = await this.getLatestSnapshot(documentId);
    let diffFromPrevious: { added: number; removed: number } | undefined;

    if (prevSnapshot) {
      diffFromPrevious = this.calculateDiff(prevSnapshot.plainText, plainText);
    }

    const snapshot: DocumentSnapshot = {
      id: `${documentId}-${Date.now()}`,
      documentId,
      yjsState: Y.encodeStateAsUpdate(ydoc),
      plainText,
      timestamp: Date.now(),
      trigger,
      summary,
      wordCount,
      diffFromPrevious,
    };

    await localDb.put(STORES.SNAPSHOTS, snapshot);

    // 更新缓存
    this.lastSnapshotTime.set(documentId, Date.now());
    this.lastSnapshotContent.set(documentId, plainText);

    // 清理旧快照
    await this.pruneSnapshots(documentId);

    console.log(`[SnapshotStore] Created ${trigger} snapshot for ${documentId}`);
    return snapshot;
  }

  /**
   * 获取文档的所有快照（按时间倒序）
   */
  async getSnapshots(documentId: string): Promise<DocumentSnapshot[]> {
    const snapshots = await localDb.getAllByIndex<DocumentSnapshot>(
      STORES.SNAPSHOTS,
      "documentId",
      documentId,
    );
    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 获取最新快照
   */
  async getLatestSnapshot(documentId: string): Promise<DocumentSnapshot | null> {
    const snapshots = await this.getSnapshots(documentId);
    return snapshots[0] || null;
  }

  /**
   * 获取指定快照
   */
  async getSnapshot(snapshotId: string): Promise<DocumentSnapshot | undefined> {
    return localDb.get<DocumentSnapshot>(STORES.SNAPSHOTS, snapshotId);
  }

  /**
   * 恢复到指定快照
   */
  async restoreSnapshot(snapshotId: string, currentYDoc: Y.Doc): Promise<boolean> {
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) return false;

    // 先创建当前状态的快照（以便撤销恢复）
    await this.createSnapshot(snapshot.documentId, currentYDoc, "restore", "恢复前自动备份");

    // 创建新的 YDoc 并应用快照状态
    const restoredDoc = new Y.Doc();
    Y.applyUpdate(restoredDoc, snapshot.yjsState);

    // 清空当前文档并应用恢复的状态
    // 注意：这会创建新的更新，与 CRDT 兼容
    const content = currentYDoc.getXmlFragment("default");
    content.delete(0, content.length);

    const restoredContent = restoredDoc.getXmlFragment("default");
    // 复制恢复的内容
    restoredContent.forEach((item, index) => {
      if (item instanceof Y.XmlElement) {
        const clone = this.cloneXmlElement(item);
        content.insert(index, [clone]);
      } else if (item instanceof Y.XmlText) {
        content.insert(index, [new Y.XmlText(item.toString())]);
      }
    });

    console.log(`[SnapshotStore] Restored to snapshot: ${snapshotId}`);
    return true;
  }

  /**
   * 对比两个快照
   */
  async compareSnapshots(
    snapshotId1: string,
    snapshotId2: string,
  ): Promise<{ before: string; after: string; diff: { added: number; removed: number } } | null> {
    const snap1 = await this.getSnapshot(snapshotId1);
    const snap2 = await this.getSnapshot(snapshotId2);

    if (!snap1 || !snap2) return null;

    const [before, after] = snap1.timestamp < snap2.timestamp ? [snap1, snap2] : [snap2, snap1];

    return {
      before: before.plainText,
      after: after.plainText,
      diff: this.calculateDiff(before.plainText, after.plainText),
    };
  }

  /**
   * 与当前文档对比
   */
  async compareWithCurrent(
    snapshotId: string,
    currentYDoc: Y.Doc,
  ): Promise<{
    before: string;
    after: string;
    diff: { added: number; removed: number };
  } | null> {
    const snapshot = await this.getSnapshot(snapshotId);
    if (!snapshot) return null;

    const currentText = this.extractPlainText(currentYDoc);

    return {
      before: snapshot.plainText,
      after: currentText,
      diff: this.calculateDiff(snapshot.plainText, currentText),
    };
  }

  /**
   * 检查是否需要自动快照
   */
  shouldAutoSnapshot(documentId: string): boolean {
    const lastTime = this.lastSnapshotTime.get(documentId) || 0;
    return Date.now() - lastTime >= SNAPSHOT_CONFIG.AUTO_INTERVAL;
  }

  /**
   * 删除快照
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    await localDb.delete(STORES.SNAPSHOTS, snapshotId);
  }

  /**
   * 清理旧快照（保留最近 N 个）
   */
  private async pruneSnapshots(documentId: string): Promise<void> {
    const snapshots = await this.getSnapshots(documentId);

    if (snapshots.length > SNAPSHOT_CONFIG.MAX_SNAPSHOTS_PER_DOC) {
      const toDelete = snapshots.slice(SNAPSHOT_CONFIG.MAX_SNAPSHOTS_PER_DOC);
      for (const snap of toDelete) {
        await localDb.delete(STORES.SNAPSHOTS, snap.id);
      }
      console.log(`[SnapshotStore] Pruned ${toDelete.length} old snapshots for ${documentId}`);
    }
  }

  /**
   * 计算文本差异
   */
  private calculateDiff(before: string, after: string): { added: number; removed: number } {
    // 简单的字符级差异计算
    // 生产环境可以使用更精确的 diff 算法
    const beforeWords = before.split(/\s+/).filter(Boolean);
    const afterWords = after.split(/\s+/).filter(Boolean);

    const beforeSet = new Set(beforeWords);
    const afterSet = new Set(afterWords);

    let added = 0;
    let removed = 0;

    for (const word of afterWords) {
      if (!beforeSet.has(word)) added++;
    }

    for (const word of beforeWords) {
      if (!afterSet.has(word)) removed++;
    }

    return { added, removed };
  }

  /**
   * 提取纯文本
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
    const blockTags = ["paragraph", "heading", "blockquote", "codeBlock", "listItem"];
    if (blockTags.includes(element.nodeName)) {
      text += "\n";
    }
    return text;
  }

  /**
   * 统计字数
   */
  private countWords(text: string): number {
    // 中文按字符计算，英文按单词计算
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    return chineseChars + englishWords;
  }

  /**
   * 克隆 XML 元素
   */
  private cloneXmlElement(element: Y.XmlElement): Y.XmlElement {
    const clone = new Y.XmlElement(element.nodeName);

    // 复制属性
    const attrs = element.getAttributes();
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined) {
        clone.setAttribute(key, value);
      }
    }

    // 复制子元素
    element.forEach((item) => {
      if (item instanceof Y.XmlText) {
        clone.push([new Y.XmlText(item.toString())]);
      } else if (item instanceof Y.XmlElement) {
        clone.push([this.cloneXmlElement(item)]);
      }
    });

    return clone;
  }

  /**
   * 获取时间轴统计
   */
  async getTimelineStats(documentId: string): Promise<{
    totalSnapshots: number;
    oldestSnapshot: number | null;
    newestSnapshot: number | null;
    triggerCounts: Record<SnapshotTrigger, number>;
  }> {
    const snapshots = await this.getSnapshots(documentId);

    const triggerCounts: Record<SnapshotTrigger, number> = {
      auto: 0,
      manual: 0,
      ai_edit: 0,
      collab_join: 0,
      restore: 0,
    };

    for (const snap of snapshots) {
      triggerCounts[snap.trigger]++;
    }

    return {
      totalSnapshots: snapshots.length,
      oldestSnapshot: snapshots.length > 0 ? snapshots[snapshots.length - 1].timestamp : null,
      newestSnapshot: snapshots.length > 0 ? snapshots[0].timestamp : null,
      triggerCounts,
    };
  }
}

// Singleton instance
export const snapshotStore = new SnapshotStore();

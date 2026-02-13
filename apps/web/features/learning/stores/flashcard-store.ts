/**
 * Flashcard Store - FSRS-5 间隔重复系统
 *
 * Local-First 架构：
 * - IndexedDB 本地存储
 * - FSRS-5 算法调度复习
 * - 支持从高亮/文档创建卡片
 */

import {
  State,
  Rating,
  schedule,
  createInitialState,
  forgettingCurve,
  type ReviewRating,
  type CardState,
} from "@nexusnote/fsrs";
import { v4 as uuid } from "uuid";
import {
  type FlashcardState,
  type LocalFlashcard,
  type LocalReviewLog,
  localDb,
  type ReviewRating as LocalReviewRating,
  STORES,
} from "@/features/shared/stores/local-db";

// 重导出供外部使用
export { State, Rating } from "@nexusnote/fsrs";

// ============================================
// Flashcard Store 类
// ============================================

export interface ScheduleResult {
  card: LocalFlashcard;
  log: LocalReviewLog;
}

export interface ReviewStats {
  totalCards: number;
  dueToday: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  averageRetention: number;
}

export class FlashcardStore {
  // ============================================
  // 卡片 CRUD
  // ============================================

  /**
   * 创建卡片（从高亮或自由创建）
   */
  async createCard(
    front: string,
    back: string,
    options: {
      highlightId?: string;
      documentId?: string;
      context?: string;
      tags?: string[];
    } = {},
  ): Promise<LocalFlashcard> {
    const now = Date.now();

    const card: LocalFlashcard = {
      id: uuid(),
      front,
      back,
      highlightId: options.highlightId,
      documentId: options.documentId,
      context: options.context,
      tags: options.tags || [],
      // FSRS 初始状态
      state: State.New,
      due: now,
      stability: 0,
      difficulty: 50, // 中等难度
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      // 元数据
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
      isDirty: true,
    };

    await localDb.put(STORES.FLASHCARDS, card);
    console.log("[FlashcardStore] Created card:", card.id);
    return card;
  }

  /**
   * 获取所有卡片
   */
  async getAllCards(): Promise<LocalFlashcard[]> {
    return localDb.getAll<LocalFlashcard>(STORES.FLASHCARDS);
  }

  /**
   * 获取单个卡片
   */
  async getCard(id: string): Promise<LocalFlashcard | undefined> {
    return localDb.get<LocalFlashcard>(STORES.FLASHCARDS, id);
  }

  /**
   * 更新卡片内容
   */
  async updateCard(
    id: string,
    updates: Partial<Pick<LocalFlashcard, "front" | "back" | "context" | "tags">>,
  ): Promise<void> {
    const card = await this.getCard(id);
    if (!card) return;

    Object.assign(card, updates, {
      updatedAt: Date.now(),
      isDirty: true,
    });

    await localDb.put(STORES.FLASHCARDS, card);
  }

  /**
   * 删除卡片
   */
  async deleteCard(id: string): Promise<void> {
    // 删除相关复习记录
    const logs = await localDb.getAllByIndex<LocalReviewLog>(STORES.REVIEW_LOGS, "flashcardId", id);
    for (const log of logs) {
      await localDb.delete(STORES.REVIEW_LOGS, log.id);
    }
    await localDb.delete(STORES.FLASHCARDS, id);
    console.log("[FlashcardStore] Deleted card:", id);
  }

  /**
   * 暂停/恢复卡片
   */
  async suspendCard(id: string, suspend = true): Promise<void> {
    const card = await this.getCard(id);
    if (!card) return;

    card.suspended = suspend ? Date.now() : undefined;
    card.updatedAt = Date.now();
    card.isDirty = true;

    await localDb.put(STORES.FLASHCARDS, card);
  }

  // ============================================
  // 复习调度 (FSRS-5)
  // ============================================

  /**
   * 获取今日到期的卡片
   */
  async getDueCards(limit = 50): Promise<LocalFlashcard[]> {
    const now = Date.now();
    const allCards = await this.getAllCards();

    return allCards
      .filter((c) => !c.suspended && c.due <= now)
      .sort((a, b) => a.due - b.due)
      .slice(0, limit);
  }

  /**
   * 获取新卡片（未学习过）
   */
  async getNewCards(limit = 20): Promise<LocalFlashcard[]> {
    const allCards = await this.getAllCards();

    return allCards
      .filter((c) => !c.suspended && c.state === State.New)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, limit);
  }

  /**
   * 复习卡片并更新调度（委托给 @nexusnote/fsrs）
   */
  async reviewCard(
    cardId: string,
    rating: ReviewRating,
    reviewDuration?: number,
  ): Promise<ScheduleResult | null> {
    const card = await this.getCard(cardId);
    if (!card) return null;

    const now = Date.now();

    // 保存复习前状态到日志
    const log: LocalReviewLog = {
      id: uuid(),
      flashcardId: card.id,
      rating,
      state: card.state,
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reviewDuration,
      reviewedAt: now,
    };

    // 从本地存储格式转换为 FSRS 格式（difficulty: /10, stability: /100）
    const result = schedule(
      {
        state: card.state as CardState,
        stability: card.stability / 100,
        difficulty: card.difficulty / 10,
        elapsedDays: card.elapsedDays,
        scheduledDays: card.scheduledDays,
        reps: card.reps,
        lapses: card.lapses,
        due: card.due,
      },
      rating,
      now,
    );

    // 从 FSRS 格式转换回本地存储格式
    card.state = result.state as FlashcardState;
    card.stability = result.stability * 100;
    card.difficulty = result.difficulty * 10;
    card.elapsedDays = result.elapsedDays;
    card.scheduledDays = result.scheduledDays;
    card.reps = result.reps;
    card.lapses = result.lapses;
    card.due = result.due;
    card.updatedAt = now;
    card.isDirty = true;

    // 保存
    await localDb.put(STORES.FLASHCARDS, card);
    await localDb.put(STORES.REVIEW_LOGS, log);

    console.log(
      `[FlashcardStore] Reviewed card ${card.id}: rating=${rating}, next due in ${card.scheduledDays} days`,
    );
    return { card, log };
  }

  // ============================================
  // 统计
  // ============================================

  /**
   * 获取复习统计
   */
  async getStats(): Promise<ReviewStats> {
    const _now = Date.now();
    const cards = await this.getAllCards();
    const activeCards = cards.filter((c) => !c.suspended);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return {
      totalCards: activeCards.length,
      dueToday: activeCards.filter((c) => c.due <= todayEnd.getTime()).length,
      newCards: activeCards.filter((c) => c.state === State.New).length,
      learningCards: activeCards.filter(
        (c) => c.state === State.Learning || c.state === State.Relearning,
      ).length,
      reviewCards: activeCards.filter((c) => c.state === State.Review).length,
      averageRetention: this.calculateAverageRetention(activeCards),
    };
  }

  private calculateAverageRetention(cards: LocalFlashcard[]): number {
    const reviewCards = cards.filter((c) => c.state === State.Review && c.stability > 0);
    if (reviewCards.length === 0) return 0;

    const now = Date.now();
    let totalRetention = 0;

    for (const card of reviewCards) {
      const elapsedDays = Math.max(0, (now - card.due) / (1000 * 60 * 60 * 24));
      const retention = forgettingCurve(elapsedDays, card.stability / 100);
      totalRetention += retention;
    }

    return Math.round((totalRetention / reviewCards.length) * 100);
  }

  /**
   * 获取今日复习历史
   */
  async getTodayReviews(): Promise<LocalReviewLog[]> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const allLogs = await localDb.getAll<LocalReviewLog>(STORES.REVIEW_LOGS);
    return allLogs
      .filter((log) => log.reviewedAt >= todayStart.getTime())
      .sort((a, b) => b.reviewedAt - a.reviewedAt);
  }

  /**
   * 获取连续学习天数
   */
  async getStreak(): Promise<number> {
    const allLogs = await localDb.getAll<LocalReviewLog>(STORES.REVIEW_LOGS);
    if (allLogs.length === 0) return 0;

    // 按天分组
    const reviewDays = new Set<string>();
    for (const log of allLogs) {
      const date = new Date(log.reviewedAt);
      reviewDays.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
    }

    // 计算连续天数
    let streak = 0;
    const today = new Date();
    const checkDate = new Date(today);

    while (true) {
      const dateKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (reviewDays.has(dateKey)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // 如果今天还没复习，检查昨天
        if (streak === 0) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yesterdayKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
          if (reviewDays.has(yesterdayKey)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }

    return streak;
  }
}

// Singleton instance
export const flashcardStore = new FlashcardStore();

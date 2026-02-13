/**
 * Flashcard Store - FSRS-5 间隔重复系统
 *
 * Local-First 架构：
 * - IndexedDB 本地存储
 * - FSRS-5 算法调度复习
 * - 支持从高亮/文档创建卡片
 */

import { v4 as uuid } from "uuid";
import {
  type FlashcardState,
  type LocalFlashcard,
  type LocalReviewLog,
  localDb,
  type ReviewRating,
  STORES,
} from "@/features/shared/stores/local-db";

// ============================================
// FSRS-5 算法核心
// ============================================

// FSRS-5 默认参数（经大规模数据优化）
const FSRS_PARAMS = {
  w: [
    0.4072,
    1.1829,
    3.1262,
    15.4722, // S0: 初始稳定性
    7.2102,
    0.5715,
    1.0,
    0.0062, // 难度相关
    1.8363,
    0.2783,
    0.8552,
    2.4029, // 稳定性增益
    0.1192,
    0.295,
    2.2663,
    0.2924, // 惩罚/奖励
    2.9466, // 遗忘稳定性
  ],
  requestRetention: 0.9,
  maximumInterval: 36500,
};

// 状态常量
export const State = {
  New: 0 as FlashcardState,
  Learning: 1 as FlashcardState,
  Review: 2 as FlashcardState,
  Relearning: 3 as FlashcardState,
};

// 评分常量
export const Rating = {
  Again: 1 as ReviewRating,
  Hard: 2 as ReviewRating,
  Good: 3 as ReviewRating,
  Easy: 4 as ReviewRating,
};

// 计算遗忘曲线
function forgettingCurve(elapsedDays: number, stability: number): number {
  return (1 + elapsedDays / (9 * stability)) ** -1;
}

// 初始难度
function initDifficulty(rating: ReviewRating): number {
  const w = FSRS_PARAMS.w;
  return Math.min(10, Math.max(1, w[4] - Math.exp(w[5] * (rating - 1)) + 1));
}

// 初始稳定性
function initStability(rating: ReviewRating): number {
  return Math.max(0.1, FSRS_PARAMS.w[rating - 1]);
}

// 计算下次间隔天数
function nextInterval(stability: number): number {
  const interval = (stability / 0.9) * (FSRS_PARAMS.requestRetention ** (1 / -0.5) - 1);
  return Math.min(FSRS_PARAMS.maximumInterval, Math.max(1, Math.round(interval)));
}

// 成功复习后的稳定性
function nextRecallStability(d: number, s: number, r: number, rating: ReviewRating): number {
  const w = FSRS_PARAMS.w;
  const hardPenalty = rating === Rating.Hard ? w[14] : 1;
  const easyBonus = rating === Rating.Easy ? w[15] : 1;

  return (
    s *
    (1 +
      Math.exp(w[8]) *
        (11 - d) *
        s ** -w[9] *
        (Math.exp((1 - r) * w[10]) - 1) *
        hardPenalty *
        easyBonus)
  );
}

// 遗忘后的稳定性
function nextForgetStability(d: number, s: number, r: number): number {
  const w = FSRS_PARAMS.w;
  return w[11] * d ** -w[12] * ((s + 1) ** w[13] - 1) * Math.exp((1 - r) * w[14]);
}

// 下次难度
function nextDifficulty(d: number, rating: ReviewRating): number {
  const w = FSRS_PARAMS.w;
  const delta = rating - 3;
  const newD = d - w[6] * delta;
  const meanReversion = w[7] * w[4] + (1 - w[7]) * newD;
  return Math.min(10, Math.max(1, meanReversion));
}

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
   * 复习卡片并更新调度
   */
  async reviewCard(
    cardId: string,
    rating: ReviewRating,
    reviewDuration?: number,
  ): Promise<ScheduleResult | null> {
    const card = await this.getCard(cardId);
    if (!card) return null;

    const now = Date.now();
    const elapsedDays =
      card.state === State.New ? 0 : Math.max(0, (now - card.due) / (1000 * 60 * 60 * 24));

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

    // 根据当前状态更新卡片
    card.elapsedDays = elapsedDays;

    switch (card.state) {
      case State.New:
        this.scheduleNew(card, rating);
        break;
      case State.Learning:
      case State.Relearning:
        this.scheduleLearning(card, rating);
        break;
      case State.Review:
        this.scheduleReview(card, rating, elapsedDays);
        break;
    }

    // 更新元数据
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

  private scheduleNew(card: LocalFlashcard, rating: ReviewRating): void {
    card.difficulty = initDifficulty(rating) * 10; // 转换为 0-100
    card.stability = initStability(rating) * 100; // 转换为整数存储

    if (rating === Rating.Again || rating === Rating.Hard) {
      card.state = State.Learning;
      card.scheduledDays = 0;
      card.due = Date.now() + 60 * 1000; // 1分钟后
    } else {
      card.state = State.Review;
      card.scheduledDays = nextInterval(card.stability / 100);
      card.due = Date.now() + card.scheduledDays * 24 * 60 * 60 * 1000;
      card.reps = 1;
    }
  }

  private scheduleLearning(card: LocalFlashcard, rating: ReviewRating): void {
    if (rating === Rating.Again || rating === Rating.Hard) {
      card.scheduledDays = 0;
      card.due = Date.now() + 60 * 1000;
    } else {
      card.state = State.Review;
      card.stability = initStability(rating) * 100;
      card.scheduledDays = nextInterval(card.stability / 100);
      card.due = Date.now() + card.scheduledDays * 24 * 60 * 60 * 1000;
      card.reps += 1;
    }
  }

  private scheduleReview(card: LocalFlashcard, rating: ReviewRating, elapsedDays: number): void {
    const stability = card.stability / 100;
    const difficulty = card.difficulty / 10;
    const retrievability = forgettingCurve(elapsedDays, stability);

    if (rating === Rating.Again) {
      card.lapses += 1;
      card.state = State.Relearning;
      card.difficulty = nextDifficulty(difficulty, rating) * 10;
      card.stability = nextForgetStability(difficulty, stability, retrievability) * 100;
      card.scheduledDays = 0;
      card.due = Date.now() + 60 * 1000;
    } else {
      card.reps += 1;
      card.difficulty = nextDifficulty(difficulty, rating) * 10;
      card.stability = nextRecallStability(difficulty, stability, retrievability, rating) * 100;
      card.scheduledDays = nextInterval(card.stability / 100);
      card.due = Date.now() + card.scheduledDays * 24 * 60 * 60 * 1000;
    }
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

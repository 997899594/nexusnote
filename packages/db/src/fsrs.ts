/**
 * FSRS-5 (Free Spaced Repetition Scheduler) 算法实现
 * 参考: https://github.com/open-spaced-repetition/fsrs4anki
 *
 * 核心概念:
 * - Stability (S): 记忆稳定性，表示多少天后遗忘概率达到 90%
 * - Difficulty (D): 卡片难度 0-10
 * - Retrievability (R): 当前回忆概率
 */

// FSRS-5 默认参数（经过大规模数据优化）
export const DEFAULT_PARAMETERS = {
  w: [
    0.4072,
    1.1829,
    3.1262,
    15.4722, // 初始稳定性 S0 (Again, Hard, Good, Easy)
    7.2102, // D0: 初始难度
    0.5715, // 难度衰减
    1.0, // 难度增益
    0.0062, // 成功复习难度变化
    1.8363, // 失败难度变化
    0.2783, // 稳定性增益斜率
    0.8552, // 稳定性增益基础
    2.4029, // 稳定性增益上限
    0.1192, // 遗忘稳定性衰减
    0.295, // 重学习稳定性
    2.2663, // Hard 惩罚
    0.2924, // Easy 奖励
    2.9466, // 遗忘后稳定性
  ],
  requestRetention: 0.9, // 目标留存率
  maximumInterval: 36500, // 最大间隔天数（100年）
};

// 卡片状态
export enum State {
  New = 0,
  Learning = 1,
  Review = 2,
  Relearning = 3,
}

// 评分
export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}

// 卡片数据
export interface Card {
  state: State;
  due: Date;
  stability: number; // 天数
  difficulty: number; // 0-10
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
}

// FSRS 复习日志（区别于数据库 ReviewLog 类型）
export interface FSRSReviewLog {
  rating: Rating;
  state: State;
  due: Date;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reviewedAt: Date;
}

// 调度结果
export interface SchedulingInfo {
  card: Card;
  log: FSRSReviewLog;
}

export interface SchedulingCards {
  again: SchedulingInfo;
  hard: SchedulingInfo;
  good: SchedulingInfo;
  easy: SchedulingInfo;
}

/**
 * FSRS 核心类
 */
export class FSRS {
  private w: number[];
  private requestRetention: number;
  private maximumInterval: number;

  constructor(params = DEFAULT_PARAMETERS) {
    this.w = params.w;
    this.requestRetention = params.requestRetention;
    this.maximumInterval = params.maximumInterval;
  }

  /**
   * 创建新卡片
   */
  createCard(): Card {
    return {
      state: State.New,
      due: new Date(),
      stability: 0,
      difficulty: 0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
    };
  }

  /**
   * 获取所有评分选项的调度结果
   */
  repeat(card: Card, now: Date): SchedulingCards {
    const result: Partial<SchedulingCards> = {};

    for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
      const scheduled = this.schedule(card, rating, now);
      const key = Rating[rating].toLowerCase() as keyof SchedulingCards;
      result[key] = scheduled;
    }

    return result as SchedulingCards;
  }

  /**
   * 单次调度
   */
  schedule(card: Card, rating: Rating, now: Date): SchedulingInfo {
    const elapsedDays =
      card.state === State.New
        ? 0
        : Math.max(0, (now.getTime() - card.due.getTime()) / (1000 * 60 * 60 * 24));

    // 创建副本
    const newCard: Card = { ...card, elapsedDays };
    const log: FSRSReviewLog = {
      rating,
      state: card.state,
      due: card.due,
      stability: card.stability,
      difficulty: card.difficulty,
      elapsedDays: card.elapsedDays,
      scheduledDays: card.scheduledDays,
      reviewedAt: now,
    };

    // 根据当前状态和评分更新
    switch (card.state) {
      case State.New:
        this.handleNew(newCard, rating);
        break;
      case State.Learning:
      case State.Relearning:
        this.handleLearning(newCard, rating);
        break;
      case State.Review:
        this.handleReview(newCard, rating, elapsedDays);
        break;
    }

    // 计算下次复习时间
    newCard.due = this.getNextDue(now, newCard.scheduledDays);

    return { card: newCard, log };
  }

  private handleNew(card: Card, rating: Rating): void {
    // 初始难度
    card.difficulty = this.initDifficulty(rating);
    // 初始稳定性
    card.stability = this.initStability(rating);

    if (rating === Rating.Again) {
      card.state = State.Learning;
      card.scheduledDays = 0; // 立即复习
    } else if (rating === Rating.Hard) {
      card.state = State.Learning;
      card.scheduledDays = 0;
    } else if (rating === Rating.Good) {
      card.state = State.Review;
      card.scheduledDays = this.nextInterval(card.stability);
      card.reps = 1;
    } else {
      // Easy
      card.state = State.Review;
      card.scheduledDays = this.nextInterval(card.stability);
      card.reps = 1;
    }
  }

  private handleLearning(card: Card, rating: Rating): void {
    if (rating === Rating.Again) {
      card.scheduledDays = 0;
    } else if (rating === Rating.Hard) {
      card.scheduledDays = 0;
    } else if (rating === Rating.Good) {
      card.state = State.Review;
      card.stability = this.initStability(rating);
      card.scheduledDays = this.nextInterval(card.stability);
      card.reps += 1;
    } else {
      // Easy
      card.state = State.Review;
      card.stability = this.initStability(rating);
      card.scheduledDays = this.nextInterval(card.stability);
      card.reps += 1;
    }
  }

  private handleReview(card: Card, rating: Rating, elapsedDays: number): void {
    const retrievability = this.forgettingCurve(elapsedDays, card.stability);

    if (rating === Rating.Again) {
      card.lapses += 1;
      card.state = State.Relearning;
      card.difficulty = this.nextDifficulty(card.difficulty, rating);
      card.stability = this.nextForgetStability(card.difficulty, card.stability, retrievability);
      card.scheduledDays = 0;
    } else {
      card.reps += 1;
      card.difficulty = this.nextDifficulty(card.difficulty, rating);
      card.stability = this.nextRecallStability(
        card.difficulty,
        card.stability,
        retrievability,
        rating,
      );
      card.scheduledDays = this.nextInterval(card.stability);
    }
  }

  // 遗忘曲线：计算当前回忆概率
  private forgettingCurve(elapsedDays: number, stability: number): number {
    return (1 + elapsedDays / (9 * stability)) ** -1;
  }

  // 初始难度
  private initDifficulty(rating: Rating): number {
    return Math.min(10, Math.max(1, this.w[4] - Math.exp(this.w[5] * (rating - 1)) + 1));
  }

  // 初始稳定性
  private initStability(rating: Rating): number {
    return Math.max(0.1, this.w[rating - 1]);
  }

  // 下次难度
  private nextDifficulty(d: number, rating: Rating): number {
    const delta = rating - 3;
    const newD = d - this.w[6] * delta;
    return Math.min(10, Math.max(1, this.meanReversion(this.w[4], newD)));
  }

  // 成功复习后的稳定性
  private nextRecallStability(d: number, s: number, r: number, rating: Rating): number {
    const hardPenalty = rating === Rating.Hard ? this.w[15] : 1;
    const easyBonus = rating === Rating.Easy ? this.w[16] : 1;

    return (
      s *
      (1 +
        Math.exp(this.w[8]) *
          (11 - d) *
          s ** -this.w[9] *
          (Math.exp((1 - r) * this.w[10]) - 1) *
          hardPenalty *
          easyBonus)
    );
  }

  // 遗忘后的稳定性
  private nextForgetStability(d: number, s: number, r: number): number {
    return (
      this.w[11] * d ** -this.w[12] * ((s + 1) ** this.w[13] - 1) * Math.exp((1 - r) * this.w[14])
    );
  }

  // 均值回归
  private meanReversion(init: number, current: number): number {
    return this.w[7] * init + (1 - this.w[7]) * current;
  }

  // 计算下次间隔
  private nextInterval(stability: number): number {
    const interval = (stability / 0.9) * (this.requestRetention ** (1 / -0.5) - 1);
    return Math.min(this.maximumInterval, Math.max(1, Math.round(interval)));
  }

  // 计算下次复习时间
  private getNextDue(now: Date, scheduledDays: number): Date {
    if (scheduledDays === 0) {
      // 学习中：1分钟后
      return new Date(now.getTime() + 60 * 1000);
    }
    const due = new Date(now);
    due.setDate(due.getDate() + scheduledDays);
    return due;
  }
}

// 默认实例
export const fsrs = new FSRS();

/**
 * 便捷函数：获取今日到期的卡片数量
 */
export function getDueCount(cards: Card[], now = new Date()): number {
  return cards.filter((c) => c.due <= now).length;
}

/**
 * 便捷函数：获取卡片状态统计
 */
export function getCardStats(cards: Card[]): {
  new: number;
  learning: number;
  review: number;
  total: number;
} {
  return {
    new: cards.filter((c) => c.state === State.New).length,
    learning: cards.filter((c) => c.state === State.Learning || c.state === State.Relearning)
      .length,
    review: cards.filter((c) => c.state === State.Review).length,
    total: cards.length,
  };
}

/**
 * @nexusnote/fsrs — FSRS-5 间隔重复调度算法
 *
 * 纯函数实现，零外部依赖。
 * 可独立用于浏览器、Node.js、Web Worker。
 *
 * FSRS-5 论文: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */

// ============================================
// 类型定义
// ============================================

/** 卡片状态 */
export const State = {
  New: 0,
  Learning: 1,
  Review: 2,
  Relearning: 3,
} as const;

export type CardState = (typeof State)[keyof typeof State];

/** 评分等级 */
export const Rating = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
} as const;

export type ReviewRating = (typeof Rating)[keyof typeof Rating];

/** FSRS 参数 */
export interface FSRSParams {
  /** 17 个权重参数 */
  w: readonly number[];
  /** 目标保留率（0-1） */
  requestRetention: number;
  /** 最大间隔天数 */
  maximumInterval: number;
}

/** 卡片调度状态（纯数据，不含业务字段） */
export interface SchedulingState {
  state: CardState;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  due: number; // timestamp
}

/** 调度结果 */
export interface SchedulingResult {
  state: SchedulingState;
  /** 各评分对应的下次复习信息 */
  preview: Record<ReviewRating, { scheduledDays: number; state: CardState }>;
}

// ============================================
// 默认参数（FSRS-5 经大规模数据优化）
// ============================================

export const DEFAULT_PARAMS: FSRSParams = {
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

// ============================================
// 核心算法（纯函数）
// ============================================

/** 遗忘曲线：计算经过 t 天后的记忆保留率 */
export function forgettingCurve(elapsedDays: number, stability: number): number {
  return (1 + elapsedDays / (9 * stability)) ** -1;
}

/** 初始难度（首次评分决定） */
export function initDifficulty(rating: ReviewRating, params: FSRSParams = DEFAULT_PARAMS): number {
  const w = params.w;
  return Math.min(10, Math.max(1, w[4]! - Math.exp(w[5]! * (rating - 1)) + 1));
}

/** 初始稳定性（首次评分决定） */
export function initStability(rating: ReviewRating, params: FSRSParams = DEFAULT_PARAMS): number {
  return Math.max(0.1, params.w[rating - 1]!);
}

/** 计算下次间隔天数 */
export function nextInterval(stability: number, params: FSRSParams = DEFAULT_PARAMS): number {
  const interval = (stability / 0.9) * (params.requestRetention ** (1 / -0.5) - 1);
  return Math.min(params.maximumInterval, Math.max(1, Math.round(interval)));
}

/** 成功复习后的新稳定性 */
export function nextRecallStability(
  d: number,
  s: number,
  r: number,
  rating: ReviewRating,
  params: FSRSParams = DEFAULT_PARAMS,
): number {
  const w = params.w;
  const hardPenalty = rating === Rating.Hard ? w[14]! : 1;
  const easyBonus = rating === Rating.Easy ? w[15]! : 1;

  return (
    s *
    (1 +
      Math.exp(w[8]!) *
        (11 - d) *
        s ** -w[9]! *
        (Math.exp((1 - r) * w[10]!) - 1) *
        hardPenalty *
        easyBonus)
  );
}

/** 遗忘后的新稳定性 */
export function nextForgetStability(
  d: number,
  s: number,
  r: number,
  params: FSRSParams = DEFAULT_PARAMS,
): number {
  const w = params.w;
  return w[11]! * d ** -w[12]! * ((s + 1) ** w[13]! - 1) * Math.exp((1 - r) * w[14]!);
}

/** 下次难度 */
export function nextDifficulty(
  d: number,
  rating: ReviewRating,
  params: FSRSParams = DEFAULT_PARAMS,
): number {
  const w = params.w;
  const delta = rating - 3;
  const newD = d - w[6]! * delta;
  const meanReversion = w[7]! * w[4]! + (1 - w[7]!) * newD;
  return Math.min(10, Math.max(1, meanReversion));
}

// ============================================
// 高级 API（组合纯函数）
// ============================================

/**
 * 调度一张卡片的下次复习
 *
 * @param current 当前调度状态
 * @param rating 用户评分
 * @param now 当前时间戳（默认 Date.now()）
 * @param params FSRS 参数（默认 FSRS-5）
 * @returns 新的调度状态
 */
export function schedule(
  current: SchedulingState,
  rating: ReviewRating,
  now: number = Date.now(),
  params: FSRSParams = DEFAULT_PARAMS,
): SchedulingState {
  const next = { ...current };
  const elapsedDays =
    current.state === State.New ? 0 : Math.max(0, (now - current.due) / (1000 * 60 * 60 * 24));

  next.elapsedDays = elapsedDays;

  switch (current.state) {
    case State.New:
      scheduleNew(next, rating, now, params);
      break;
    case State.Learning:
    case State.Relearning:
      scheduleLearning(next, rating, now, params);
      break;
    case State.Review:
      scheduleReview(next, rating, elapsedDays, now, params);
      break;
  }

  return next;
}

function scheduleNew(
  card: SchedulingState,
  rating: ReviewRating,
  now: number,
  params: FSRSParams,
): void {
  card.difficulty = initDifficulty(rating, params);
  card.stability = initStability(rating, params);

  if (rating === Rating.Again || rating === Rating.Hard) {
    card.state = State.Learning;
    card.scheduledDays = 0;
    card.due = now + 60 * 1000; // 1 分钟
  } else {
    card.state = State.Review;
    card.scheduledDays = nextInterval(card.stability, params);
    card.due = now + card.scheduledDays * 24 * 60 * 60 * 1000;
    card.reps = 1;
  }
}

function scheduleLearning(
  card: SchedulingState,
  rating: ReviewRating,
  now: number,
  params: FSRSParams,
): void {
  if (rating === Rating.Again || rating === Rating.Hard) {
    card.scheduledDays = 0;
    card.due = now + 60 * 1000;
  } else {
    card.state = State.Review;
    card.stability = initStability(rating, params);
    card.scheduledDays = nextInterval(card.stability, params);
    card.due = now + card.scheduledDays * 24 * 60 * 60 * 1000;
    card.reps += 1;
  }
}

function scheduleReview(
  card: SchedulingState,
  rating: ReviewRating,
  elapsedDays: number,
  now: number,
  params: FSRSParams,
): void {
  const retrievability = forgettingCurve(elapsedDays, card.stability);

  if (rating === Rating.Again) {
    card.lapses += 1;
    card.state = State.Relearning;
    card.difficulty = nextDifficulty(card.difficulty, rating, params);
    card.stability = nextForgetStability(card.difficulty, card.stability, retrievability, params);
    card.scheduledDays = 0;
    card.due = now + 60 * 1000;
  } else {
    card.reps += 1;
    card.difficulty = nextDifficulty(card.difficulty, rating, params);
    card.stability = nextRecallStability(
      card.difficulty,
      card.stability,
      retrievability,
      rating,
      params,
    );
    card.scheduledDays = nextInterval(card.stability, params);
    card.due = now + card.scheduledDays * 24 * 60 * 60 * 1000;
  }
}

/**
 * 创建一张新卡片的初始调度状态
 */
export function createInitialState(now: number = Date.now()): SchedulingState {
  return {
    state: State.New,
    stability: 0,
    difficulty: 5, // 中等难度（1-10 范围）
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    due: now,
  };
}

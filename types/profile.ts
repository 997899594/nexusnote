/**
 * 用户画像相关类型定义
 */

/**
 * 指数移动平均值类型
 * 用于风格分析和个性特征的持续追踪
 */
export interface EMAValue {
  /** 当前值 (0-1 范围) */
  value: number;
  /** 置信度 (0-1，随样本增加提高) */
  confidence: number;
  /** 累计样本数 */
  samples: number;
  /** 最后分析时间 (ISO 字符串) */
  lastAnalyzedAt: string;
}

/** 写作风格维度 */
export type StyleDimension =
  | 'vocabularyComplexity'
  | 'sentenceComplexity'
  | 'abstractionLevel'
  | 'directness'
  | 'conciseness'
  | 'formality'
  | 'emotionalIntensity';

/** Big Five 人格维度 */
export type BigFiveDimension =
  | 'openness'
  | 'conscientiousness'
  | 'extraversion'
  | 'agreeableness'
  | 'neuroticism';

/** 所有可追踪维度 */
export type TrackableDimension = StyleDimension | BigFiveDimension;

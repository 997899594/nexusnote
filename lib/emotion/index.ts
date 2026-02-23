/**
 * Emotion Detection & Response Adaptation - Export
 */

export type { EmotionSignal, EmotionType } from "./detector";
export {
  detectEmotion,
  detectEmotionBatch,
  detectEmotionTrend,
  getEmotionEmoji,
  getEmotionLabel,
} from "./detector";
export type { AdaptationStrategy } from "./response-adapter";
export {
  adaptResponseForEmotion,
  adaptResponseForEmotions,
  buildEmotionAdaptationPrompt,
  getResponseOpening,
} from "./response-adapter";

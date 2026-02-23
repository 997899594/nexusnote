/**
 * Emotion Detection & Response Adaptation - Export
 */

export {
  detectEmotion,
  detectEmotionBatch,
  detectEmotionTrend,
  getEmotionLabel,
  getEmotionEmoji,
} from "./detector";
export type { EmotionSignal, EmotionType } from "./detector";

export {
  adaptResponseForEmotion,
  adaptResponseForEmotions,
  buildEmotionAdaptationPrompt,
  getResponseOpening,
} from "./response-adapter";
export type { AdaptationStrategy } from "./response-adapter";

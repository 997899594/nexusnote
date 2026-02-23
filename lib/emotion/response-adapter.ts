/**
 * Emotion Response Adapter
 *
 * Generates AI response adaptation instructions based on detected emotions.
 * Works with emotion detector to modify AI behavior.
 */

import type { EmotionSignal, EmotionType } from "./detector";

// ============================================
// Response Adaptation Strategies
// ============================================

export interface AdaptationStrategy {
  instruction: string;
  tone: string;
  priority: "high" | "medium" | "low";
}

const STRATEGIES: Record<EmotionType, AdaptationStrategy> = {
  confused: {
    instruction:
      "User is confused. Rephrase your explanation using different approach. Use simpler language or concrete examples. Ask clarifying questions to understand the source of confusion.",
    tone: "patient and supportive",
    priority: "high",
  },

  urgent: {
    instruction:
      "User is in a hurry. Keep your response concise and focused. Get straight to the point without unnecessary elaboration. Use bullet points if helpful.",
    tone: "direct and efficient",
    priority: "high",
  },

  giving_up: {
    instruction:
      "User seems ready to give up. Acknowledge their frustration, validate that the topic is challenging, and offer a different approach or break it down into smaller steps. Ask if they want to try a different angle.",
    tone: "encouraging and understanding",
    priority: "high",
  },

  satisfied: {
    instruction:
      "User is satisfied with the current direction. Acknowledge their success and build on it. Briefly reinforce what they've learned before moving forward.",
    tone: "positive and affirming",
    priority: "low",
  },

  frustrated: {
    instruction:
      "User is frustrated after repeated failures. Acknowledge the difficulty, validate their effort, and suggest taking a fresh approach. Avoid blame. Consider suggesting a break or a completely different method.",
    tone: "empathetic and solution-focused",
    priority: "high",
  },

  excited: {
    instruction:
      "User is excited! Match their energy and enthusiasm. Celebrate their success and help channel that energy into next steps. Keep the momentum going.",
    tone: "enthusiastic and encouraging",
    priority: "medium",
  },

  curious: {
    instruction:
      "User is curious and wants to learn more. Provide additional context and interesting details. Suggest related topics they might find interesting. Encourage exploration.",
    tone: "engaging and informative",
    priority: "medium",
  },

  neutral: {
    instruction:
      "Proceed with normal communication. No special adaptation needed.",
    tone: "neutral",
    priority: "low",
  },
};

// ============================================
// Adaptation Functions
// ============================================

/**
 * Get response adaptation instruction for detected emotion
 *
 * Returns instructions that can be appended to AI system prompt.
 */
export function adaptResponseForEmotion(emotion: EmotionSignal): string {
  const strategy = STRATEGIES[emotion.emotion];

  // Adjust instruction based on intensity
  let instruction = strategy.instruction;

  if (emotion.intensity > 0.8 && strategy.priority === "high") {
    // High intensity emotions need stronger adaptation
    instruction = `[HIGH PRIORITY] ${instruction}`;
  }

  // Add confidence note if confidence is low
  if (emotion.confidence < 0.7) {
    instruction += `\n(Note: Emotion detection confidence is ${(emotion.confidence * 100).toFixed(0)}% - adapt cautiously)`;
  }

  return instruction;
}

/**
 * Get response adaptation for multiple emotions
 *
 * When multiple emotions are detected, prioritize by priority and intensity.
 */
export function adaptResponseForEmotions(
  emotions: EmotionSignal[],
): string | null {
  if (emotions.length === 0) {
    return null;
  }

  // Sort by priority (high first) then by intensity
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  const sortedEmotions = [...emotions].sort((a, b) => {
    const priorityDiff =
      priorityOrder[STRATEGIES[a.emotion].priority] -
      priorityOrder[STRATEGIES[b.emotion].priority];
    if (priorityDiff !== 0) return priorityDiff;
    return b.intensity - a.intensity;
  });

  // Use the top-priority emotion
  return adaptResponseForEmotion(sortedEmotions[0]);
}

/**
 * Build full system prompt section for emotion adaptation
 */
export function buildEmotionAdaptationPrompt(emotion: EmotionSignal | null): string {
  if (!emotion) {
    return "";
  }

  const strategy = STRATEGIES[emotion.emotion];
  const adaptation = adaptResponseForEmotion(emotion);

  return `
=== Emotional Adaptation ===
Detected emotion: ${emotion.emotion} (confidence: ${(emotion.confidence * 100).toFixed(0)}%, intensity: ${(emotion.intensity * 100).toFixed(0)}%)
Target tone: ${strategy.tone}

${adaptation}
`;
}

/**
 * Get suggested response opening based on emotion
 */
export function getResponseOpening(emotion: EmotionType): string {
  const openings: Record<EmotionType, string[]> = {
    confused: [
      "让我换个方式来解释...",
      "我来用更简单的方式说明...",
      "也许用个例子会更容易理解...",
    ],
    urgent: [
      "直接说：",
      "简而言之：",
      "重点是：",
    ],
    giving_up: [
      "我知道这个问题挺棘手的...",
      "这种概念确实不容易掌握，我们换个思路...",
      "别灰心，我们试个不同的方法...",
    ],
    satisfied: [
      "很好！你理解得很对。",
      "正是如此！继续保持。",
      "你的思路完全正确。",
    ],
    frustrated: [
      "我理解你的挫败感，这个确实有挑战性...",
      "让我们重新梳理一下，换个角度试试...",
      "遇到困难是正常的，我们一步步来...",
    ],
    excited: [
      "太棒了！让我们趁热打铁！",
      "这个进展很棒！接下来...",
      "你的理解完全正确！继续保持！",
    ],
    curious: [
      "这是个很好的探索方向！",
      "让我来展开说明...",
      "你可能会对以下内容感兴趣...",
    ],
    neutral: [
      "好的，",
      "让我们继续，",
      "",
    ],
  };

  const options = openings[emotion];
  return options[Math.floor(Math.random() * options.length)];
}

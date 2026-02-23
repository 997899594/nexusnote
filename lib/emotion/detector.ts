/**
 * Emotion Detection
 *
 * Detects user emotions from message content using pattern matching.
 * Used to adapt AI responses to user's emotional state.
 */

// ============================================
// Types
// ============================================

export type EmotionType =
  | "confused"
  | "urgent"
  | "giving_up"
  | "satisfied"
  | "frustrated"
  | "excited"
  | "curious"
  | "neutral";

export interface EmotionSignal {
  emotion: EmotionType;
  confidence: number;
  intensity: number; // 0-1, how strong the emotion is
  cues: string[]; // The words/phrases that triggered this detection
}

// ============================================
// Detection Rules
// ============================================

interface EmotionRule {
  patterns: RegExp[];
  emotion: EmotionType;
  baseConfidence: number;
  // Keywords that amplify intensity
  intensifiers?: string[];
  // Keywords that reduce intensity
  dampeners?: string[];
}

const EMOTION_RULES: EmotionRule[] = [
  {
    patterns: [
      /什么意思|不懂|没明白|不理解|看不懂|啥意思/gi,
      /什么.*说|怎么回事|如何.*理解/gi,
      /can'?t understand|don'?t get|confused|what do you mean/gi,
    ],
    emotion: "confused",
    baseConfidence: 0.8,
    intensifiers: ["完全", "根本", "彻底", "at all", "completely"],
    dampeners: ["有点", "稍微", "a little", "somewhat"],
  },
  {
    patterns: [
      /快点|太慢|直接说|别.*废话|长话短说/gi,
      /hurry|rush|faster|get to the point|cut to the chase/gi,
    ],
    emotion: "urgent",
    baseConfidence: 0.75,
    intensifiers: ["赶紧", "马上", "现在", "now", "immediately"],
  },
  {
    patterns: [
      /算了|随便吧|不用了|没关系|不重要/gi,
      /forget it|never mind|whatever|doesn'?t matter/gi,
    ],
    emotion: "giving_up",
    baseConfidence: 0.7,
    intensifiers: ["反正", "就这样", "anyway", "whatever"],
  },
  {
    patterns: [
      /太好了|完美|正是|对了|就是这样/gi,
      /great|perfect|exactly|that'?s it|yes.*exactly/gi,
      /终于.*了|成功|搞定|解决了/gi,
    ],
    emotion: "satisfied",
    baseConfidence: 0.85,
    intensifiers: ["太", "非常", "超级", "so", "very", "super"],
  },
  {
    patterns: [
      /怎么做.*错|还是不行|又.*了|总是.*失败/gi,
      /not working|still failing|keep.*getting|always.*wrong/gi,
      /烦死了|烦|郁闷|糟糕/gi,
    ],
    emotion: "frustrated",
    baseConfidence: 0.8,
    intensifiers: ["总是", "每次", "永远", "always", "every time", "forever"],
  },
  {
    patterns: [/太棒了|哇|天哪| amazing|awesome|incredible/gi, /终于|成功了|做到了|yes.*did.*it/gi],
    emotion: "excited",
    baseConfidence: 0.85,
    intensifiers: ["!!!", "！！！", "so", "very", "超级"],
  },
  {
    patterns: [
      /想知道.*|特别.*好奇|对.*很好奇|curious about|really want to know/gi,
      /还有.*吗|能不能.*更多|tell me more|interested in/gi,
    ],
    emotion: "curious",
    baseConfidence: 0.7,
    intensifiers: ["特别", "非常", "really", "very"],
  },
];

// ============================================
// Detection Function
// ============================================

/**
 * Detect emotion from user message
 *
 * Analyzes message content and returns detected emotion with confidence.
 */
export function detectEmotion(message: string): EmotionSignal | null {
  if (!message || message.trim().length < 2) {
    return null;
  }

  const results: Array<{ emotion: EmotionSignal; matchCount: number }> = [];

  for (const rule of EMOTION_RULES) {
    const cues: string[] = [];
    let matchCount = 0;

    for (const pattern of rule.patterns) {
      const matches = message.match(pattern);
      if (matches) {
        matchCount += matches.length;
        cues.push(...matches);
      }
    }

    if (matchCount > 0) {
      // Calculate intensity based on intensifiers and dampeners
      let intensityModifier = 0;

      if (rule.intensifiers) {
        for (const intensifier of rule.intensifiers) {
          if (message.toLowerCase().includes(intensifier.toLowerCase())) {
            intensityModifier += 0.15;
          }
        }
      }

      if (rule.dampeners) {
        for (const dampener of rule.dampeners) {
          if (message.toLowerCase().includes(dampener.toLowerCase())) {
            intensityModifier -= 0.1;
          }
        }
      }

      // Check for exclamation marks (increase intensity)
      const exclamations = (message.match(/!/g) || []).length;
      if (exclamations > 0) {
        intensityModifier += Math.min(exclamations * 0.05, 0.2);
      }

      const confidence = Math.min(0.95, rule.baseConfidence + matchCount * 0.05);
      const intensity = Math.min(1, Math.max(0.3, 0.5 + intensityModifier));

      results.push({
        emotion: {
          emotion: rule.emotion,
          confidence,
          intensity,
          cues: [...new Set(cues)], // Deduplicate
        },
        matchCount,
      });
    }
  }

  if (results.length === 0) {
    return null;
  }

  // Return the emotion with most matches
  results.sort((a, b) => b.matchCount - a.matchCount);
  return results[0].emotion;
}

/**
 * Batch detect emotions from multiple messages
 */
export function detectEmotionBatch(messages: string[]): EmotionSignal[] {
  return messages.map((msg) => detectEmotion(msg)).filter((e): e is EmotionSignal => e !== null);
}

/**
 * Detect emotion trend from recent messages
 *
 * Returns the dominant emotion and whether it's increasing, stable, or decreasing.
 */
export function detectEmotionTrend(messages: string[]): {
  emotion: EmotionSignal | null;
  trend: "increasing" | "stable" | "decreasing";
} {
  if (messages.length < 2) {
    return { emotion: detectEmotion(messages[0] || ""), trend: "stable" };
  }

  const recentEmotions = detectEmotionBatch(messages.slice(-5)); // Last 5 messages

  if (recentEmotions.length === 0) {
    return { emotion: null, trend: "stable" };
  }

  // Count by emotion type
  const emotionCounts = new Map<EmotionType, { count: number; totalIntensity: number }>();
  for (const e of recentEmotions) {
    const existing = emotionCounts.get(e.emotion) || { count: 0, totalIntensity: 0 };
    emotionCounts.set(e.emotion, {
      count: existing.count + 1,
      totalIntensity: existing.totalIntensity + e.intensity,
    });
  }

  // Find dominant emotion
  let dominantEmotion: EmotionType | null = null;
  let maxCount = 0;
  for (const [emotion, data] of emotionCounts.entries()) {
    if (data.count > maxCount) {
      maxCount = data.count;
      dominantEmotion = emotion;
    }
  }

  if (!dominantEmotion) {
    return { emotion: null, trend: "stable" };
  }

  const dominantData = emotionCounts.get(dominantEmotion)!;
  const avgIntensity = dominantData.totalIntensity / dominantData.count;

  // Compare with earlier messages to determine trend
  const earlierEmotions = detectEmotionBatch(messages.slice(0, -5));
  const earlierCount = earlierEmotions.filter((e) => e.emotion === dominantEmotion).length;

  let trend: "increasing" | "stable" | "decreasing" = "stable";
  if (maxCount > earlierCount + 1) {
    trend = "increasing";
  } else if (maxCount < earlierCount - 1) {
    trend = "decreasing";
  }

  return {
    emotion: {
      emotion: dominantEmotion,
      confidence: Math.min(0.95, 0.6 + maxCount * 0.1),
      intensity: avgIntensity,
      cues: [],
    },
    trend,
  };
}

/**
 * Get emotion display label (Chinese)
 */
export function getEmotionLabel(emotion: EmotionType): string {
  const labels: Record<EmotionType, string> = {
    confused: "困惑",
    urgent: "着急",
    giving_up: "放弃",
    satisfied: "满意",
    frustrated: "沮丧",
    excited: "兴奋",
    curious: "好奇",
    neutral: "平静",
  };
  return labels[emotion] || emotion;
}

/**
 * Get emotion emoji
 */
export function getEmotionEmoji(emotion: EmotionType): string {
  const emojis: Record<EmotionType, string> = {
    confused: "😕",
    urgent: "⏰",
    giving_up: "😔",
    satisfied: "😊",
    frustrated: "😤",
    excited: "🎉",
    curious: "🤔",
    neutral: "😐",
  };
  return emojis[emotion] || "😐";
}

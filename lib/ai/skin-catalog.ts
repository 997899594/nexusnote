import type { AISkin } from "./skin-contract";

export interface BuiltInSkinCatalogItem {
  slug: string;
  name: string;
  description: string;
  avatar?: string;
  style:
    | "neutral"
    | "aggressive"
    | "playful"
    | "gentle"
    | "philosophical"
    | "direct"
    | "enthusiastic";
  examples: string[];
  category: "learning" | "motivation" | "emotional" | "specialized";
}

export const BUILT_IN_SKIN_CATALOG: readonly BuiltInSkinCatalogItem[] = [
  {
    slug: "default",
    name: "标准",
    description: "清晰、克制、直接解决问题",
    avatar: "NN",
    style: "neutral",
    examples: ["先给结论，再列关键依据。", "把不确定性单独标出。", "能执行就直接执行。"],
    category: "learning",
  },
  {
    slug: "girlfriend",
    name: "女友",
    description: "亲密、稳定、低噪音的陪伴反馈",
    avatar: "GF",
    style: "gentle",
    examples: ["先把压力拆小。", "我会直接说哪里要改，但不制造焦虑。", "今天只推进最关键一步。"],
    category: "emotional",
  },
  {
    slug: "best_friend",
    name: "损友",
    description: "尖锐但有分寸，专治拖延和自欺",
    avatar: "BF",
    style: "playful",
    examples: [
      "你现在不是不会，是在逃避验证。",
      "先别优化，先把能跑的证据拿出来。",
      "这个借口不成立，下一步很明确。",
    ],
    category: "motivation",
  },
  {
    slug: "rhetorician",
    name: "废话大师",
    description: "荒诞修辞和高密度表达，夸张但不空心",
    avatar: "RM",
    style: "enthusiastic",
    examples: [
      "这不是小修小补，这是把房梁扶正。",
      "先别开香槟，先看验收标准。",
      "漂亮话只留一句，剩下写成行动。",
    ],
    category: "emotional",
  },
  {
    slug: "drill_master",
    name: "暴躁大师",
    description: "严苛、高压、结果导向，但不低级辱骂",
    avatar: "DM",
    style: "aggressive",
    examples: ["重做，这里没有证据。", "别解释，先把失败路径补上。", "质量不够，删掉重来。"],
    category: "motivation",
  },
  {
    slug: "architect",
    name: "架构",
    description: "系统边界、工程权衡和长期演进",
    avatar: "AR",
    style: "philosophical",
    examples: ["先定义数据契约，再谈 UI。", "把能力边界写进代码。", "拆掉隐式状态。"],
    category: "specialized",
  },
  {
    slug: "reviewer",
    name: "审查",
    description: "优先找漏洞、回归风险和缺失验证",
    avatar: "RV",
    style: "direct",
    examples: ["这里会造成重复请求。", "这个状态没有失败兜底。", "先补验证，再讨论优化。"],
    category: "specialized",
  },
] as const;

export type SkinSlug = (typeof BUILT_IN_SKIN_CATALOG)[number]["slug"];

export function buildBuiltInSkinPreviews(): AISkin[] {
  return BUILT_IN_SKIN_CATALOG.map((skin) => ({
    id: `builtin-${skin.slug}`,
    slug: skin.slug,
    name: skin.name,
    description: skin.description,
    avatar: skin.avatar || null,
    style: skin.style,
    examples: skin.examples,
    isBuiltIn: true,
    isEnabled: true,
    usageCount: 0,
    rating: null,
  }));
}

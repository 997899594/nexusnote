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
    slug: "direct",
    name: "直给",
    description: "压缩铺垫，保留判断和下一步",
    avatar: "DR",
    style: "direct",
    examples: [
      "这不是信息不足，是优先级没定。",
      "先删掉会误导用户的分支。",
      "只保留能验证的方案。",
    ],
    category: "motivation",
  },
  {
    slug: "architect",
    name: "架构",
    description: "适合系统设计、工程权衡和长期演进",
    avatar: "AR",
    style: "philosophical",
    examples: [
      "把能力边界写进代码，不靠提示词兜底。",
      "先定义数据契约，再谈 UI。",
      "拆掉隐式状态。",
    ],
    category: "specialized",
  },
  {
    slug: "coach",
    name: "教练",
    description: "少讲概念，多推动练习和反馈闭环",
    avatar: "CO",
    style: "gentle",
    examples: ["先做一个最小可验证练习。", "我会指出你下一步该改哪里。", "用结果校准理解。"],
    category: "learning",
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

import { AI_CAPABILITIES, type AICapability } from "./capabilities";
import { BILLING_PLANS, type BillingPlanId } from "./plans";

export interface ProductFeature {
  id: string;
  label: string;
  capability?: AICapability;
}

export interface PricingPeriod {
  id: "month" | "year";
  planId: BillingPlanId;
  amountCents: number;
  monthlyEquivalentCents: number;
  savingsPercent: number;
}

export interface PricingCatalog {
  freeFeatures: ProductFeature[];
  proFeatures: ProductFeature[];
  periods: Record<PricingPeriod["id"], PricingPeriod>;
  trialDays: number;
}

export interface PricingAccountStatus {
  kind: "anonymous" | "free" | "trial" | "pro";
  planId: BillingPlanId | null;
  expiresAt: string | null;
}

const FREE_FEATURES: ProductFeature[] = [
  {
    id: AI_CAPABILITIES.basicChat,
    label: "基础 AI 对话，受公平使用限速保护",
    capability: AI_CAPABILITIES.basicChat,
  },
  { id: "course_interview", label: "课程访谈与蓝图调整" },
  { id: "public_course_learning", label: "浏览和学习公开课程" },
  { id: "knowledge_workspace", label: "笔记、高亮与知识沉淀" },
  { id: "course_publishing", label: "发布已有课程并接收学习反馈" },
];

const PRO_FEATURES: ProductFeature[] = [
  {
    id: AI_CAPABILITIES.courseGeneration,
    label: "生成和持续更新自有课程",
    capability: AI_CAPABILITIES.courseGeneration,
  },
  {
    id: AI_CAPABILITIES.research,
    label: "联网研究、资料核验与引用",
    capability: AI_CAPABILITIES.research,
  },
  { id: "course_section_generation", label: "按学习进度生成课程章节" },
];

function buildPricingPeriods(): PricingCatalog["periods"] {
  const monthly = BILLING_PLANS.pro_month;
  const yearly = BILLING_PLANS.pro_year;
  const yearlyAtMonthlyPrice = monthly.amountCents * 12;

  return {
    month: {
      id: "month",
      planId: monthly.id,
      amountCents: monthly.amountCents,
      monthlyEquivalentCents: monthly.amountCents,
      savingsPercent: 0,
    },
    year: {
      id: "year",
      planId: yearly.id,
      amountCents: yearly.amountCents,
      monthlyEquivalentCents: Math.round(yearly.amountCents / 12),
      savingsPercent: Math.round((1 - yearly.amountCents / yearlyAtMonthlyPrice) * 100),
    },
  };
}

export function getPricingCatalog(): PricingCatalog {
  return {
    freeFeatures: FREE_FEATURES,
    proFeatures: PRO_FEATURES,
    periods: buildPricingPeriods(),
    trialDays: 7,
  };
}

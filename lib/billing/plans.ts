import { z } from "zod";

export const BillingPlanIdSchema = z.enum(["pro_month", "pro_year"]);

export type BillingPlanId = z.infer<typeof BillingPlanIdSchema>;

export interface BillingPlan {
  id: BillingPlanId;
  name: string;
  amountCents: number;
  currency: "CNY";
  entitlementDays: number;
}

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  pro_month: {
    id: "pro_month",
    name: "Pro 月卡",
    amountCents: 1900,
    currency: "CNY",
    entitlementDays: 31,
  },
  pro_year: {
    id: "pro_year",
    name: "Pro 年卡",
    amountCents: 19900,
    currency: "CNY",
    entitlementDays: 366,
  },
};

export function getBillingPlan(planId: BillingPlanId): BillingPlan {
  return BILLING_PLANS[planId];
}

import type { GrowthNodeState } from "@/lib/growth/types";

export function getGrowthStateLabel(state: GrowthNodeState | string | null | undefined): string {
  switch (state) {
    case "mastered":
      return "已掌握";
    case "in_progress":
      return "学习中";
    case "ready":
      return "可开始";
    case "locked":
      return "待解锁";
    default:
      return "进行中";
  }
}

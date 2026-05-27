import { tool } from "ai";
import { careerMapDraftSchema } from "@/lib/ai/career-planning/schemas";

export interface PresentCareerMapDraftOutput {
  status: "presented";
}

export function createCareerPlanningTools() {
  return {
    presentCareerMapDraft: tool({
      description:
        "在职业访谈中更新职业地图草稿。用于把课程观察、路线排序、关键缺口、下一步行动和下一个澄清问题以结构化数据交给前端。必须基于已有课程/职业树/访谈信号，不要把主观偏好当成已掌握技能。",
      inputSchema: careerMapDraftSchema,
      execute: async (): Promise<PresentCareerMapDraftOutput> => ({
        status: "presented",
      }),
    }),
  };
}

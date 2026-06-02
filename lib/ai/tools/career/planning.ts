import { tool } from "ai";
import { careerGraphPatchSchema } from "@/lib/ai/career-planning/schemas";

export interface PresentCareerGraphPatchOutput {
  status: "presented";
}

export function createCareerPlanningTools() {
  return {
    presentCareerGraphPatch: tool({
      description: [
        "在职业访谈中输出职业成长图补丁。用于把目标节点、能力缺口、验证任务、证据关系和下一个澄清问题以结构化数据交给前端。",
        "你必须先完成 diagnosis 隐藏诊断框架，选择一个 interviewTechnique，再通过 qualityGate；如果不能让 changesGraph、reducesUncertainty、evidenceBounded、notProfileDump 都为 true，就先修正问题再调用工具。",
        "必须基于已有课程/职业树/访谈信号；不要把主观偏好当成已掌握技能。引用已存在职业树节点时优先复用原 node id 写入 highlightNodeIds。",
        "早期校准可以 nodes/edges 为空，但 nextQuestion 必须是一个真实职业规划师会问的高杠杆问题。优先把不确定性转成 validation_task，而不是泛泛建议。",
      ].join(" "),
      inputSchema: careerGraphPatchSchema,
      execute: async (): Promise<PresentCareerGraphPatchOutput> => ({
        status: "presented",
      }),
    }),
  };
}

import { tool } from "ai";
import { careerGraphPatchSchema } from "@/lib/ai/career-planning/schemas";

export interface PresentCareerGraphPatchOutput {
  status: "presented";
}

export function createCareerPlanningTools() {
  return {
    presentCareerGraphPatch: tool({
      description: [
        "在职业访谈中输出职业成长图补丁和导师判断。用于把导师观察、候选职业方向、技能优先级、研究来源、目标节点、能力缺口、验证任务、证据关系和下一个澄清问题以结构化数据交给前端。",
        "每次调用都必须优先填写 mentorBrief：先给职业规划导师的判断，再给 2-4 个现实职业方向和 2-5 个技能优先级，最后只问一个温和校准问题。",
        "recommendedDirections 必须使用现实职业名，并填写 counselorTake 与 decisionPressure；不要输出抽象路线、课程名、能力名，也不要使用 fit/upside/growth/tradeoff 这类展示维度。",
        "你必须先完成 diagnosis 隐藏诊断框架，选择一个 interviewTechnique，再通过 qualityGate；如果不能让 changesGraph、reducesUncertainty、evidenceBounded、notProfileDump 都为 true，就先修正问题再调用工具。",
        "必须基于已有课程/职业树/访谈信号；不要把主观偏好当成已掌握技能。引用已存在职业树节点时优先复用原 node id 写入 highlightNodeIds。",
        "涉及前沿职业、未来发展、薪资/市场热度/岗位趋势，或本地课程证据不足时，先调用 webSearch，再把来源写入 mentorBrief.researchSources 和 evidence。",
        "禁止把课程章节技术点包装成考试题；nextQuestion 必须像真实职业规划导师或心理辅导老师一样自然，目的是校准价值取向、工作方式、约束或验证动作。",
        "禁止伪口语、训斥、段子化和复读机式模板，例如“先说人话”“别急着”“封神”“硬骨头”“下水道”。",
        "早期校准可以 nodes/edges 为空，但 mentorBrief 和 nextQuestion 必须真实推动路线判断。优先把不确定性转成 validation_task，而不是泛泛建议。",
      ].join(" "),
      inputSchema: careerGraphPatchSchema,
      execute: async (): Promise<PresentCareerGraphPatchOutput> => ({
        status: "presented",
      }),
    }),
  };
}

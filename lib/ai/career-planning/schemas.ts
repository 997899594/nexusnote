import { z } from "zod";

export const careerGraphNodeTypeSchema = z.enum([
  "current_skill",
  "target_role",
  "future_path",
  "skill_gap",
  "validation_task",
  "course",
  "evidence",
]);

export const careerGraphEdgeTypeSchema = z.enum([
  "supports",
  "requires",
  "bridges_to",
  "validates",
  "learns_from",
]);

export const careerGraphPatchOperationSchema = z.enum([
  "create",
  "calibrate",
  "redirect",
  "commit",
]);

export const careerGraphPatchConfidenceSchema = z.enum(["low", "medium", "high"]);

export const careerGraphPatchInterviewTechniqueSchema = z.enum([
  "achievement_event",
  "counterfactual_tradeoff",
  "constraint_probe",
  "evidence_probe",
  "failure_sample",
  "market_calibration",
  "validation_design",
]);

export const careerGraphPatchDiagnosisSchema = z.object({
  motivation: z.string().min(1).max(220),
  capabilityEvidence: z.string().min(1).max(220),
  constraints: z.string().min(1).max(220),
  workStyle: z.string().min(1).max(220),
  targetHypothesis: z.string().min(1).max(220),
  marketHypothesis: z.string().min(1).max(220),
  risk: z.string().min(1).max(220),
  nextValidation: z.string().min(1).max(220),
});

export const careerGraphPatchQualityGateSchema = z.object({
  changesGraph: z.literal(true),
  reducesUncertainty: z.literal(true),
  evidenceBounded: z.literal(true),
  notProfileDump: z.literal(true),
  nextQuestionPurpose: z.string().min(1).max(180),
});

export const careerGraphPatchNodeSchema = z.object({
  id: z.string().min(1).max(140),
  type: careerGraphNodeTypeSchema,
  title: z.string().min(1).max(100),
  summary: z.string().min(1).max(260),
  status: z.enum(["provisional", "evidence_backed", "committed"]).default("provisional"),
  source: z.enum(["course", "skill_tree", "insight", "interview", "research"]).default("interview"),
  confidence: careerGraphPatchConfidenceSchema.default("low"),
});

export const careerGraphPatchEdgeSchema = z.object({
  id: z.string().min(1).max(160),
  type: careerGraphEdgeTypeSchema,
  fromNodeId: z.string().min(1).max(140),
  toNodeId: z.string().min(1).max(140),
  summary: z.string().min(1).max(220).optional(),
});

export const careerGraphPatchEvidenceSchema = z.object({
  id: z.string().min(1).max(140),
  source: z.enum(["course", "skill_tree", "insight", "interview", "research"]),
  title: z.string().min(1).max(100),
  summary: z.string().min(1).max(220),
});

export const careerGraphPatchNextQuestionSchema = z
  .object({
    question: z
      .string()
      .min(1)
      .max(180)
      .describe(
        "只问一个开放式职业校准问题。问题必须校准职业动机、约束、工作方式、风险承受或长期取舍；禁止项目交付选择题、考试题和资料表式问题。",
      ),
    rationale: z.string().min(1).max(180).optional(),
  })
  .strict();

export const careerMentorDirectionSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(80)
    .describe("现实职业名称，不是课程名、能力路线、抽象方向或营销标题。"),
  counselorTake: z
    .string()
    .min(1)
    .max(180)
    .describe("像职业规划导师一样，用一句自然判断说明为什么这个方向值得进入候选。"),
  decisionPressure: z
    .string()
    .min(1)
    .max(160)
    .describe("这个方向真正要用户面对的验证点、代价或取舍，用自然语言表达，不写标签。"),
  source: z.enum(["course", "skill_tree", "interview", "research", "mixed"]).default("mixed"),
});

export const careerMentorSkillPrioritySchema = z.object({
  title: z.string().min(1).max(80),
  why: z.string().min(1).max(140),
  source: z.enum(["course", "skill_tree", "interview", "research", "mixed"]).default("mixed"),
});

export const careerMentorResearchSourceSchema = z.object({
  sourceId: z.string().min(1).max(140).optional(),
  title: z.string().min(1).max(120),
  url: z.string().url(),
  domain: z.string().min(1).max(80).optional(),
  provider: z.string().min(1).max(40).optional(),
  qualityTier: z.string().min(1).max(40).optional(),
});

export const careerMentorBriefSchema = z.object({
  greeting: z.string().min(1).max(80).optional(),
  openingObservation: z
    .string()
    .min(1)
    .max(260)
    .describe("用户可见的导师判断。必须专业、克制、有人味，禁止伪口语、训斥或测评腔。"),
  recommendedDirections: z.array(careerMentorDirectionSchema).min(1).max(4),
  skillPriorities: z.array(careerMentorSkillPrioritySchema).min(1).max(5),
  marketContext: z.string().min(1).max(220).optional(),
  researchSources: z.array(careerMentorResearchSourceSchema).max(5).default([]),
});

export const careerGraphPatchSchema = z.object({
  intent: z.string().min(1).max(140),
  operation: careerGraphPatchOperationSchema,
  summary: z.string().min(1).max(240),
  author: z.enum(["ai", "system"]).default("ai"),
  targetDirectionKey: z.string().min(1).max(120).optional(),
  confidence: careerGraphPatchConfidenceSchema,
  nodes: z.array(careerGraphPatchNodeSchema).max(12).default([]),
  edges: z.array(careerGraphPatchEdgeSchema).max(16).default([]),
  evidence: z.array(careerGraphPatchEvidenceSchema).max(6).default([]),
  highlightNodeIds: z.array(z.string().min(1).max(140)).max(6).default([]),
  diagnosis: careerGraphPatchDiagnosisSchema,
  interviewTechnique: careerGraphPatchInterviewTechniqueSchema,
  qualityGate: careerGraphPatchQualityGateSchema,
  mentorBrief: careerMentorBriefSchema.optional(),
  nextQuestion: careerGraphPatchNextQuestionSchema,
});

export type CareerGraphPatch = z.infer<typeof careerGraphPatchSchema>;
export type CareerMentorBrief = z.infer<typeof careerMentorBriefSchema>;
export type CareerMentorDirection = z.infer<typeof careerMentorDirectionSchema>;
export type CareerMentorSkillPriority = z.infer<typeof careerMentorSkillPrioritySchema>;

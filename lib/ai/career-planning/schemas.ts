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

export const careerGraphPatchNextQuestionSchema = z.object({
  question: z.string().min(1).max(180),
  rationale: z.string().min(1).max(180).optional(),
  options: z.array(z.string().min(1).max(80)).min(2).max(4).optional(),
});

export const careerMentorDirectionSchema = z.object({
  title: z.string().min(1).max(80),
  reason: z.string().min(1).max(160),
  fit: z.string().min(1).max(120),
  upside: z.string().min(1).max(120),
  growth: z.string().min(1).max(120),
  tradeoff: z.string().min(1).max(140),
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
  openingObservation: z.string().min(1).max(220),
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

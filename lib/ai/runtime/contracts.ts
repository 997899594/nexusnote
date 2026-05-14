import type { AIRouteProfile } from "@/lib/ai/core/route-profiles";
import type { RequestMetadata } from "@/types/request-metadata";

export const SURFACE_VALUES = ["chat", "learn", "notes", "career", "interview"] as const;

export type Surface = (typeof SURFACE_VALUES)[number];

export const CAPABILITY_MODE_VALUES = [
  "general_chat",
  "learn_coach",
  "note_assistant",
  "research_assistant",
  "career_guide",
  "course_interviewer",
] as const;

export type CapabilityMode = (typeof CAPABILITY_MODE_VALUES)[number];

export const CONVERSATION_CAPABILITY_MODE_VALUES = [
  "general_chat",
  "learn_coach",
  "note_assistant",
  "research_assistant",
  "career_guide",
] as const;

export type ConversationCapabilityMode = (typeof CONVERSATION_CAPABILITY_MODE_VALUES)[number];

export const EXECUTION_MODE_VALUES = [
  "direct_answer",
  "tool_loop",
  "workflow",
  "redirect",
  "ask_clarification",
] as const;

export type ExecutionMode = (typeof EXECUTION_MODE_VALUES)[number];

export const DATA_SCOPE_VALUES = ["session", "course", "notes", "career_tree", "web"] as const;

export type DataScope = (typeof DATA_SCOPE_VALUES)[number];

export const ROUTING_INTENT_VALUES = [
  "general_assistance",
  "learn_explanation",
  "note_work",
  "research_lookup",
  "career_guidance",
  "course_interview",
] as const;

export type RoutingIntent = (typeof ROUTING_INTENT_VALUES)[number];

export interface RequestResourceContext {
  courseId?: string;
  chapterIndex?: number;
  sectionIndex?: number;
  documentId?: string;
}

export interface RequestUserPolicy {
  routeProfile: AIRouteProfile;
  skinSlug?: string | null;
}

export interface RequestContext {
  surface: Surface;
  sessionId: string | null;
  recentMessages: string[];
  metadata?: RequestMetadata;
  resourceContext: RequestResourceContext;
  hasLearningGuidance: boolean;
  hasCareerTreeSnapshot: boolean;
  hasEditorContext: boolean;
  userPolicy: RequestUserPolicy;
}

export interface IntentClassification {
  intent: RoutingIntent;
  capabilityMode: CapabilityMode;
  executionMode: ExecutionMode;
  requiredScopes: DataScope[];
  confidence: number;
  reasons: string[];
}

export interface RouteDecision extends IntentClassification {
  resolvedCapabilityMode: ConversationCapabilityMode;
  handoffTarget: CapabilityMode | null;
  arbiterNotes: string[];
  assistantInstruction: string | null;
}

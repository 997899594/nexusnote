import { z } from "zod";
import {
  CAPABILITY_MODE_VALUES,
  CONVERSATION_CAPABILITY_MODE_VALUES,
  DATA_SCOPE_VALUES,
  EXECUTION_MODE_VALUES,
  ROUTING_INTENT_VALUES,
} from "@/lib/ai/runtime/contracts";

export const routingIntentSchema = z.enum(ROUTING_INTENT_VALUES);
export const capabilityModeSchema = z.enum(CAPABILITY_MODE_VALUES);
export const conversationCapabilityModeSchema = z.enum(CONVERSATION_CAPABILITY_MODE_VALUES);
export const executionModeSchema = z.enum(EXECUTION_MODE_VALUES);
export const dataScopeSchema = z.enum(DATA_SCOPE_VALUES);

export const intentClassificationSchema = z.object({
  intent: routingIntentSchema,
  capabilityMode: capabilityModeSchema,
  executionMode: executionModeSchema,
  requiredScopes: z.array(dataScopeSchema).max(5),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string().trim().min(1)).min(1).max(5),
});

export const routeDecisionSchema = intentClassificationSchema.extend({
  resolvedCapabilityMode: conversationCapabilityModeSchema,
  handoffTarget: capabilityModeSchema.nullable(),
  arbiterNotes: z.array(z.string().trim().min(1)).max(6),
  assistantInstruction: z.string().trim().min(1).nullable(),
});

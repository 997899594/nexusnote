import { z } from "zod";

// ==========================================
// State Definitions
// ==========================================

export type InterviewState =
  | "IDLE" // Initial state
  | "ASK_GOAL" // Asking for learning goal
  | "ASK_BACKGROUND" // Asking for background knowledge
  | "ASK_TIME" // Asking for time commitment
  | "CONFIRM" // Confirmation before generation
  | "GENERATING" // Generating the outline
  | "COMPLETED"; // Interview finished

// ==========================================
// Output Schemas (for streamObject)
// ==========================================

// Context data structure
export interface InterviewContext {
  goal?: string;
  background?: string;
  time?: string;
  [key: string]: any;
}

// Context update schema
export const ContextUpdateSchema = z
  .object({
    goal: z.string().optional(),
    background: z.string().optional(),
    time: z.string().optional(),
  })
  .describe(
    "Updates to the interview context extracted from the previous user input.",
  );

// Base schema for UI updates
export const UIResponseSchema = z.object({
  message: z
    .string()
    .describe(
      "The text to display to the user (the question or confirmation).",
    ),
  type: z
    .enum(["text", "options", "confirmation", "status"])
    .describe("The UI component type to render."),
  contextUpdates: ContextUpdateSchema.optional(),
});

// Specific schemas for different states

export const OptionsResponseSchema = UIResponseSchema.extend({
  type: z.literal("options"),
  options: z
    .array(z.string())
    .describe("List of options for the user to choose from."),
  multiSelect: z
    .boolean()
    .default(false)
    .describe("Whether multiple options can be selected."),
});

export const ConfirmationResponseSchema = UIResponseSchema.extend({
  type: z.literal("confirmation"),
  summary: z
    .object({
      goal: z.string(),
      background: z.string(),
      time: z.string(),
    })
    .describe("Summary of collected information."),
});

export const StatusResponseSchema = UIResponseSchema.extend({
  type: z.literal("status"),
  status: z
    .string()
    .describe('Current status message (e.g., "Generating outline...").'),
});

// Union schema for the stream
export const InterviewResponseSchema = z.union([
  UIResponseSchema,
  OptionsResponseSchema,
  ConfirmationResponseSchema,
  StatusResponseSchema,
]);

export type InterviewResponse = z.infer<typeof InterviewResponseSchema>;

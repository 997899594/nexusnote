/**
 * Skills Validation - 技能 API Zod 验证 Schema
 */

import { z } from "zod";

export const DiscoverSkillsSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50),
  sources: z.array(
    z.enum(["conversations", "knowledge", "courses", "flashcards"]),
  ).optional().default(["conversations", "knowledge", "courses", "flashcards"]),
});

export const GraphQuerySchema = z.object({
  includeUnlocked: z.coerce.boolean().optional().default(true),
  maxDepth: z.coerce.number().min(1).max(5).optional().default(2),
});

export const RecommendQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(50).optional().default(10),
});

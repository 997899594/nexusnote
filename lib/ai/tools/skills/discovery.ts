/**
 * Skills Tools - 技能发现工具
 */

import { tool } from "ai";
import { z } from "zod";

export const DiscoverSkillsToolSchema = z.object({
  userId: z.string().describe("用户 ID"),
  limit: z.number().min(1).max(100).optional().default(50).describe("数据条数限制"),
  sources: z
    .array(z.enum(["conversations", "knowledge", "courses", "flashcards"]))
    .optional()
    .describe("数据来源列表"),
});

export type DiscoverSkillsToolInput = z.infer<typeof DiscoverSkillsToolSchema>;

export const discoverSkillsTool = tool({
  description: "从用户的学习数据中发现并提取技能",
  inputSchema: DiscoverSkillsToolSchema,
  execute: async ({ userId, limit = 50, sources }) => {
    try {
      const response = await fetch("/api/skills/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, limit, sources }),
      });

      if (!response.ok) {
        throw new Error(`Failed to discover skills: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        success: true,
        count: data.count || 0,
        skills: data.skills || [],
      };
    } catch (error) {
      console.error("[Tool] discoverSkills error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        skills: [],
        count: 0,
      };
    }
  },
});

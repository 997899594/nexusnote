/**
 * Skills Tools - 技能发现工具
 */

import { tool } from "ai";
import { z } from "zod";
import { discoverAndSaveSkills } from "@/lib/skills/discovery";

export const DiscoverSkillsToolSchema = z.object({
  limit: z.number().min(1).max(100).optional().default(50).describe("数据条数限制"),
  sources: z
    .array(z.enum(["conversations", "knowledge", "courses"]))
    .optional()
    .describe("数据来源列表"),
});

export type DiscoverSkillsToolInput = z.infer<typeof DiscoverSkillsToolSchema>;

/**
 * 创建 discoverSkills tool，绑定 userId
 */
export function createDiscoverSkillsTool(userId: string) {
  return tool({
    description: "从用户的学习数据中发现并提取技能",
    inputSchema: DiscoverSkillsToolSchema,
    execute: async ({ limit = 50, sources }) => {
      try {
        const skills = await discoverAndSaveSkills(userId, {
          limit,
          sources: sources as Array<"conversations" | "knowledge" | "courses">,
        });

        return {
          success: true,
          count: skills.length,
          skills: skills.map((s) => ({
            name: s.name,
            category: s.category,
            confidence: s.confidence,
          })),
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
}

// 向后兼容：保留旧的无 userId 版本（标记为 deprecated）
export const discoverSkillsTool = tool({
  description: "[DEPRECATED] 使用 createDiscoverSkillsTool(userId) 代替",
  inputSchema: DiscoverSkillsToolSchema,
  execute: async () => {
    console.warn(
      "[Tool] discoverSkillsTool is deprecated. Use createDiscoverSkillsTool(userId) instead.",
    );
    return {
      success: false,
      error: "Tool requires userId context. Use createDiscoverSkillsTool(userId).",
      skills: [],
      count: 0,
    };
  },
});

/**
 * Chat Tools - 闪卡
 */

import { db, flashcards } from "@/db";
import { tool } from "ai";
import { z } from "zod";

export const CreateFlashcardsSchema = z.object({
  cards: z.array(
    z.object({
      front: z.string().describe("卡片正面（问题/提示）"),
      back: z.string().describe("卡片背面（答案/解释）"),
    }),
  ),
  context: z.string().optional(),
});

export type CreateFlashcardsInput = z.infer<typeof CreateFlashcardsSchema>;

export const createFlashcardsTool = tool({
  description: `用于辅助间隔重复记忆 (Spaced Repetition)。适用于：1. 识别到明确的定义、公式或关键事实；2. 用户表达需要"记住"某事。`,
  inputSchema: CreateFlashcardsSchema,
  execute: async (args) => {
    try {
      // TODO: Get userId from session context
      // For now, create without userId (will be added later with proper auth)
      const created = await db
        .insert(flashcards)
        .values(
          args.cards.map((card) => ({
            front: card.front,
            back: card.back,
            context: args.context,
          })),
        )
        .returning();

      return {
        success: true,
        count: created.length,
        cards: created.map((c) => ({
          id: c.id,
          front: c.front,
          back: c.back,
        })),
      };
    } catch (error) {
      console.error("[Tool] createFlashcards error:", error);
      return {
        success: false,
        error: "创建闪卡失败",
      };
    }
  },
});

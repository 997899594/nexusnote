/**
 * generateOutline Tool
 *
 * 2026 终极架构：前端状态接力流 (Frontend Handoff Streaming)
 *
 * 此工具只做"状态变轨"：
 * 1. 更新 DB 状态为 'generating_outline'
 * 2. 返回 HANDOFF 信令给前端
 * 3. 不调用 LLM，毫秒级返回
 *
 * 大纲生成由前端监听 signal 后，向独立的 API 发起流式请求
 */

import { tool } from "ai";
import { z } from "zod";
import { db } from "@/db";
import { courseSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

// ============================================
// Tool Schema & Types
// ============================================

const EmptySchema = z.object({});

interface GenerateOutlineOutput {
  success: boolean;
  signal: string;
  message: string;
  courseId: string;
}

// ============================================
// Tool Factory
// ============================================

export interface GenerateOutlineToolInput {
  courseId: string;
}

export function createGenerateOutlineTool(params: GenerateOutlineToolInput) {
  const { courseId } = params;

  return {
    generateOutline: tool({
      description:
        "当信息饱和度超过 80% 时调用此工具。结束访谈。将控制权交给教研引擎。调用后只需对用户说：'我已经完全了解您的需求了！我们的教研大脑正在为您生成专属大纲,马上呈现...。",
      inputSchema: EmptySchema,
      execute: async (_args: z.infer<typeof EmptySchema>): Promise<GenerateOutlineOutput> => {
        try {
          // 1. 将课程状态从 'interviewing' 切换到 'generating_outline'
          await db
            .update(courseSessions)
            .set({
              status: "generating_outline",
              updatedAt: new Date(),
            })
            .where(eq(courseSessions.id, courseId));

          console.log("[generateOutline] Course status changed to generating_outline:", courseId);

          // 2. 返回 HANDOFF 信令给前端
          return {
            success: true,
            signal: "HANDOFF_TO_ARCHITECT",
            message: "大纲生成任务已触发",
            courseId,
          };
        } catch (error) {
          console.error("[generateOutline] Error:", error);
          return {
            success: false,
            signal: "ERROR",
            message: error instanceof Error ? error.message : "Unknown error",
            courseId,
          };
        }
      },
    }),
  };
}

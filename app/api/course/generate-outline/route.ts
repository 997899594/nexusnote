/**
 * Generate Outline API
 *
 * 独立的大纲生成路由 - The Architect Route
 *
 * 职责：
 * 1. 从数据库加载 blueprint + extractedFacts
 * 2. 用 proModel (深度推理模型) 生成大纲
 * 3. 流式返回结构化大纲
 *
 * 设计原则：
 * - 与访谈 Agent 物理隔离
 * - 独立的流式输出，永不超时
 * - 使用更强的模型进行深度推理
 */

import { streamObject } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { courseSessions, topicBlueprints } from "@/db/schema";
import { aiProvider } from "@/lib/ai/core";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes for deep reasoning

// ============================================
// Outline Schema for Streaming
// ============================================

const OutlineSchema = z.object({
  title: z.string().describe("课程标题"),
  description: z.string().optional().describe("课程简介"),
  estimatedMinutes: z.number().min(10).max(480).describe("预计学习时长（分钟）"),
  chapters: z
    .array(
      z.object({
        title: z.string().describe("章节标题"),
        description: z.string().optional().describe("章节简介"),
        topics: z.array(z.string()).describe("本章包含的知识点"),
        order: z.number().describe("章节顺序"),
      }),
    )
    .min(2)
    .max(10)
    .describe("课程章节"),
});

// ============================================
// API Handler
// ============================================

export async function POST(request: NextRequest) {
  try {
    // 1. 认证
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    // 2. 解析请求
    const body = await request.json();
    const { courseId } = body;

    if (!courseId) {
      throw new APIError("缺少 courseId", 400, "MISSING_COURSE_ID");
    }

    // 3. 加载课程状态
    const course = await db.query.courseSessions.findFirst({
      where: (c, { eq, and }) => and(eq(c.id, courseId), eq(c.userId, userId)),
    });

    if (!course) {
      throw new APIError("课程不存在", 404, "COURSE_NOT_FOUND");
    }

    const profile = course.interviewProfile as {
      currentTopic?: string;
      extractedFacts?: Array<{
        dimension: string;
        value: string | number | boolean;
      }>;
      blueprintId?: string;
      saturationScore?: number;
    } | null;

    if (!profile) {
      throw new APIError("访谈数据不完整", 400, "PROFILE_INCOMPLETE");
    }

    // 4. 加载蓝图
    let blueprint = null;
    if (profile.blueprintId) {
      blueprint = await db.query.topicBlueprints.findFirst({
        where: (t, { eq }) => eq(t.id, profile.blueprintId!),
      });
    }

    // 5. 准备上下文
    const topic = profile.currentTopic || "学习新知识";
    const facts = profile.extractedFacts || [];

    const factsSummary = facts
      .map((f) => `- ${f.dimension}: ${String(f.value)}`)
      .join("\n");

    const dimensionsSummary = blueprint?.coreDimensions
      ? (blueprint.coreDimensions as Array<{ name: string; weight: number; suggestion: string }>)
          .map((d) => `- ${d.name}（权重${d.weight}%）: ${d.suggestion}`)
          .join("\n")
      : "- 通用学习路径";

    // 6. 使用 proModel 深度推理生成大纲
    const model = aiProvider.proModel;

    // 7. 流式生成
    const result = streamObject({
      model,
      schema: OutlineSchema,
      prompt: `你是一位专业的课程设计师。请为用户生成一份高度个性化的学习大纲。

## 学习主题
${topic}

## 用户画像（基于访谈收集）
${factsSummary}

## 评估维度（参考）
${dimensionsSummary}

## 设计要求
1. 根据用户画像定制学习路径
2. 章节数量 2-6 个，每个章节 2-5 个知识点
3. 预计学习时长 10-300 分钟
4. 标题简洁有力，直击痛点
5. 知识点要具体可执行，避免空洞描述
6. 考虑用户的实际水平和学习目标

请生成学习大纲。`,
      onFinish: async ({ object }) => {
        // 生成完成后，保存大纲到数据库
        if (object) {
          await db
            .update(courseSessions)
            .set({
              status: "outline_ready",
              outlineData: object,
              updatedAt: new Date(),
            })
            .where(eq(courseSessions.id, courseId));

          console.log("[generate-outline] Outline saved for course:", courseId);
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (error) {
    return handleError(error);
  }
}

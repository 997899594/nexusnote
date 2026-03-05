/**
 * Interview API - 动态访谈接口
 *
 * 熵驱动架构：
 * - 本地关键词匹配（零延迟评估）
 * - 异步蓝图生成
 * - 原生话题漂移支持
 * - 纯 EAV 模式（无固定槽位）
 */

import type { UIMessage } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { conversations, courseSessions, db, eq } from "@/db";
import type { InterviewProfile } from "@/db/schema";
import { aiProvider, getAgent, validateRequest } from "@/lib/ai";
import { getBlueprint, triggerBlueprintGeneration } from "@/lib/ai/blueprint";
import { createNexusNoteStreamResponse } from "@/lib/ai/streaming";
import { APIError, handleError } from "@/lib/api";
import { auth } from "@/lib/auth";
import type { PendingFact } from "@/types/interview";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * 创建新的动态访谈 profile
 */
function createNewProfile(topic: string): InterviewProfile {
  return {
    currentTopic: topic,
    currentTopicId: crypto.randomUUID(),
    extractedFacts: [],
    saturationScore: 0,
    nextHighValueDimensions: [],
    blueprintStatus: "pending",
  };
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      throw new APIError("请先登录", 401, "UNAUTHORIZED");
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new APIError("无效的 JSON", 400, "INVALID_JSON");
    }

    const validation = validateRequest(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", details: validation.error.issues } },
        { status: 400 },
      );
    }

    const { messages, sessionId, courseId: inputCourseId } = validation.data;

    if (!aiProvider.isConfigured()) {
      throw new APIError("AI 服务未配置", 503, "AI_NOT_CONFIGURED");
    }

    // ============================================
    // 从第一条用户消息提取主题
    // ============================================
    const uiMessages = messages as UIMessage[];
    const firstUserMessage = uiMessages.find((m) => m.role === "user");
    let topic = "学习新知识";

    if (firstUserMessage?.parts) {
      const textPart = firstUserMessage.parts.find((p) => p.type === "text");
      if (textPart && "text" in textPart) {
        topic = textPart.text.slice(0, 200);
      }
    }

    // ============================================
    // 获取或创建课程
    // ============================================
    let activeCourseId = inputCourseId;

    if (activeCourseId) {
      const existingCourse = await db.query.courseSessions.findFirst({
        where: (c, { eq, and }) => and(eq(c.id, activeCourseId!), eq(c.userId, userId)),
      });

      if (!existingCourse) {
        activeCourseId = undefined;
      }
    }

    if (!activeCourseId) {
      // 创建新的课程会话
      const [newCourse] = await db
        .insert(courseSessions)
        .values({
          userId,
          title: topic,
          interviewProfile: createNewProfile(topic),
          interviewStatus: "interviewing",
          status: "idle",
        })
        .returning();

      activeCourseId = newCourse.id;

      // 触发蓝图生成（异步）
      triggerBlueprintGeneration(topic);

      console.log("[Interview] Created course:", activeCourseId, "topic:", topic);
    } else {
      // 检查现有课程的 profile
      const existingCourse = await db.query.courseSessions.findFirst({
        where: (c, { eq }) => eq(c.id, activeCourseId!),
      });

      if (existingCourse) {
        const profile = existingCourse.interviewProfile as InterviewProfile | null;

        // 如果没有 profile 或没有 currentTopic，初始化
        if (!profile?.currentTopic) {
          await db
            .update(courseSessions)
            .set({
              interviewProfile: createNewProfile(topic),
              updatedAt: new Date(),
            })
            .where(eq(courseSessions.id, activeCourseId!));

          triggerBlueprintGeneration(topic);
        }
      }
    }

    // 获取最新的课程状态
    const course = await db.query.courseSessions.findFirst({
      where: (c, { eq }) => eq(c.id, activeCourseId!),
    });

    const profile = course?.interviewProfile as InterviewProfile | null;
    const currentTopic = profile?.currentTopic ?? topic;
    const currentTopicId = profile?.currentTopicId ?? crypto.randomUUID();
    const existingFacts = profile?.extractedFacts ?? [];
    const blueprintStatus = profile?.blueprintStatus ?? "pending";

    // ============================================
    // 创建/更新 conversation 记录
    // ============================================
    if (sessionId) {
      try {
        await db
          .insert(conversations)
          .values({
            id: sessionId,
            userId,
            title: topic.slice(0, 100),
            intent: "INTERVIEW",
            messageCount: uiMessages.length,
            metadata: { courseId: activeCourseId },
          })
          .onConflictDoUpdate({
            target: conversations.id,
            set: {
              messageCount: uiMessages.length,
              lastMessageAt: new Date(),
              metadata: { courseId: activeCourseId },
            },
          });
      } catch (insertError) {
        console.warn("[Interview] Failed to upsert session:", insertError);
      }
    }

    // ============================================
    // 获取 Blueprint
    // ============================================
    const blueprint = await getBlueprint(currentTopic);

    // ============================================
    // 获取 Interview Agent（传入动态上下文 + DB 回调）
    // ============================================
    const agent = getAgent("INTERVIEW", {
      courseProfileId: activeCourseId,
      currentTopic,
      currentTopicId,
      existingFacts,
      blueprint,
      blueprintStatus,

      // 依赖注入：DB 操作回调
      // 【幽灵回滚修复】绝不使用闭包变量，始终从数据库获取最新状态
      onFactsUpdate: async (facts: PendingFact[]) => {
        // 始终查询最新状态（避免闭包陷阱）
        const existingCourse = await db.query.courseSessions.findFirst({
          where: (c, { eq }) => eq(c.id, activeCourseId!),
        });
        const existingProfile = existingCourse?.interviewProfile as InterviewProfile | null;

        // 【核心修复】使用 spread operator 继承数据库中【最新】的所有状态
        // 只覆盖需要更新的字段，绝不触碰 currentTopic/currentTopicId
        const updatedProfile: InterviewProfile = {
          ...existingProfile, // 继承最新状态（包括刚被漂移改掉的 Topic）
          extractedFacts: facts,
          saturationScore: existingProfile?.saturationScore ?? 0,
          nextHighValueDimensions: existingProfile?.nextHighValueDimensions ?? [],
          blueprintStatus: existingProfile?.blueprintStatus ?? "pending",
          blueprintId: existingProfile?.blueprintId,
        } as InterviewProfile;

        await db
          .update(courseSessions)
          .set({
            interviewProfile: updatedProfile,
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, activeCourseId!));
      },

      onTopicChange: async (newTopic: string): Promise<string> => {
        const newTopicId = crypto.randomUUID();

        // 触发新主题的蓝图生成
        triggerBlueprintGeneration(newTopic);

        // 获取现有 profile（始终查询最新）
        const existingCourse = await db.query.courseSessions.findFirst({
          where: (c, { eq }) => eq(c.id, activeCourseId!),
        });
        const existingProfile = existingCourse?.interviewProfile as InterviewProfile | null;

        // 保留共享事实
        const sharedFacts = (existingProfile?.extractedFacts ?? [])
          .filter((f) => f.isShared)
          .map((f) => ({
            ...f,
            topicId: newTopicId,
            extractedAt: new Date().toISOString(),
          }));

        // 更新 profile
        const updatedProfile: InterviewProfile = {
          ...existingProfile, // 继承其他属性
          currentTopic: newTopic,
          currentTopicId: newTopicId,
          extractedFacts: sharedFacts,
          saturationScore: 0,
          nextHighValueDimensions: [],
          blueprintStatus: "pending",
          blueprintId: undefined,
        } as InterviewProfile;

        await db
          .update(courseSessions)
          .set({
            interviewProfile: updatedProfile,
            updatedAt: new Date(),
          })
          .where(eq(courseSessions.id, activeCourseId!));

        return newTopicId;
      },
    });

    const response = await createNexusNoteStreamResponse(agent, uiMessages);

    const durationMs = Date.now() - startTime;
    console.log("[Interview] Request completed in", durationMs, "ms");

    if (sessionId) {
      response.headers.set("X-Session-Id", sessionId);
    }
    if (activeCourseId) {
      response.headers.set("X-Course-Id", activeCourseId);
    }

    return response;
  } catch (error) {
    return handleError(error);
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    ai: { configured: aiProvider.isConfigured() },
    timestamp: new Date().toISOString(),
  });
}

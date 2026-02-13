"use server";

/**
 * 2026 架构师标准：Server Actions 核心中心
 *
 * 职责：
 * 1. 替代传统的 fetch /api 模式，提供类型安全的直接调用
 * 2. 处理认证与授权逻辑
 * 3. 封装数据库原子操作
 */

import { and, courseChapters, courseProfiles, db, eq } from "@nexusnote/db";
import { revalidatePath } from "next/cache";
import { createSafeAction } from "@/lib/actions/action-utils";
import type { CourseChapterDTO, CourseProfileDTO } from "@/lib/actions/types";
import {
  getCourseChapters as dbGetChapters,
  saveCourseProfile as dbSaveProfile,
  updateCourseProgress as dbUpdateProgress,
  type OutlineData,
} from "@/lib/ai/profile/course-profile";

/**
 * 保存课程画像
 */
export const saveCourseProfileAction = createSafeAction(
  "saveCourseProfile",
  async (
    payload: {
      id?: string;
      goal: string;
      background: string;
      targetOutcome: string;
      cognitiveStyle: string;
      outlineData: OutlineData;
      designReason: string;
    },
    userId,
  ) => {
    const id = await dbSaveProfile({
      userId,
      ...payload,
    });

    // 清除相关缓存，确保数据最新
    revalidatePath(`/learn/${id}`);

    return { courseId: id };
  },
);

/**
 * 获取课程章节列表
 */
export const getCourseChaptersAction = createSafeAction(
  "getCourseChapters",
  async (
    courseId: string,
    userId,
  ): Promise<{ chapters: CourseChapterDTO[]; profile: CourseProfileDTO }> => {
    // 权限校验：确保用户只能访问自己的课程
    const profile = await db.query.courseProfiles.findFirst({
      where: and(eq(courseProfiles.id, courseId), eq(courseProfiles.userId, userId)),
    });

    if (!profile) {
      throw new Error("Course not found or unauthorized");
    }

    const chapters = await dbGetChapters(courseId);

    // 映射为 DTO
    const chapterDTOs: CourseChapterDTO[] = chapters.map((c) => ({
      id: c.id,
      chapterIndex: c.chapterIndex,
      sectionIndex: c.sectionIndex,
      title: c.title,
      contentMarkdown: c.contentMarkdown,
      summary: null,
      keyPoints: null,
      isCompleted: false, // 初始状态
      createdAt: c.createdAt ? c.createdAt.toISOString() : new Date().toISOString(),
    }));

    return {
      chapters: chapterDTOs,
      profile: {
        id: profile.id,
        title: profile.title,
        progress: {
          currentChapter: profile.currentChapter || 0,
          currentSection: profile.currentSection || 1,
        },
        userId: profile.userId || userId,
        goal: profile.goal,
        background: profile.background,
        targetOutcome: profile.targetOutcome,
        cognitiveStyle: profile.cognitiveStyle,
        outlineData: profile.outlineData as OutlineData,
      },
    };
  },
);

/**
 * 获取特定章节内容
 */
export const getChapterContentAction = createSafeAction(
  "getChapterContent",
  async (
    payload: {
      courseId: string;
      chapterIndex: number;
      sectionIndex?: number;
    },
    userId,
  ): Promise<CourseChapterDTO> => {
    const { courseId, chapterIndex, sectionIndex = 1 } = payload;

    // 权限校验
    const profile = await db.query.courseProfiles.findFirst({
      where: and(eq(courseProfiles.id, courseId), eq(courseProfiles.userId, userId)),
    });

    if (!profile) {
      throw new Error("Course not found or unauthorized");
    }

    const chapter = await db.query.courseChapters.findFirst({
      where: and(
        eq(courseChapters.profileId, courseId),
        eq(courseChapters.chapterIndex, chapterIndex),
        eq(courseChapters.sectionIndex, sectionIndex),
      ),
    });

    if (!chapter) {
      throw new Error("Chapter content not found");
    }

    return {
      id: chapter.id,
      chapterIndex: chapter.chapterIndex,
      sectionIndex: chapter.sectionIndex,
      title: chapter.title,
      contentMarkdown: chapter.contentMarkdown,
      summary: null,
      keyPoints: null,
      isCompleted: false,
      createdAt: chapter.createdAt ? chapter.createdAt.toISOString() : new Date().toISOString(),
    };
  },
);

/**
 * 更新课程进度
 */
export const updateCourseProgressAction = createSafeAction(
  "updateCourseProgress",
  async (
    payload: {
      courseId: string;
      currentChapter: number;
      currentSection?: number;
    },
    userId,
  ) => {
    const { courseId, currentChapter, currentSection = 1 } = payload;

    // 权限校验
    const profile = await db.query.courseProfiles.findFirst({
      where: and(eq(courseProfiles.id, courseId), eq(courseProfiles.userId, userId)),
    });

    if (!profile) {
      throw new Error("Course not found or unauthorized");
    }

    await dbUpdateProgress(courseId, {
      currentChapter,
      currentSection,
    });
  },
);

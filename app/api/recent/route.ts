/**
 * Recent Activity API - 获取用户最近的学习活动
 *
 * GET: 获取最近的活动记录（课程、闪卡、测验、笔记、会话等）
 */

import { and, desc, eq, gt, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import {
  conversations,
  courseProfiles,
  documents,
  flashcards,
  db,
} from "@/db";
import { authOptions } from "../auth/[...nextauth]/route";

interface RecentItem {
  id: string;
  type: "course" | "flashcard" | "quiz" | "note" | "chat" | "mindmap";
  title: string;
  desc: string;
  time: string;
  icon: string;
  url: string;
}

function formatTime(date: Date | null): string {
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays === 1) return "昨天";
  if (diffDays < 7) return `${diffDays}天前`;
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ items: [] });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "6", 10), 20);

    const items: RecentItem[] = [];

    // 1. 最近课程 (courseProfiles)
    const courses = await db
      .select({
        id: courseProfiles.id,
        title: courseProfiles.title,
        description: courseProfiles.description,
        updatedAt: courseProfiles.updatedAt,
        currentChapter: courseProfiles.currentChapter,
        isCompleted: courseProfiles.isCompleted,
      })
      .from(courseProfiles)
      .where(eq(courseProfiles.userId, userId))
      .orderBy(desc(courseProfiles.updatedAt))
      .limit(limit);

    for (const course of courses) {
      const progress = course.isCompleted
        ? "已完成"
        : course.currentChapter
          ? `进行中 (第${course.currentChapter + 1}章)`
          : "未开始";
      items.push({
        id: course.id,
        type: "course",
        title: course.title || "未命名课程",
        desc: course.description?.slice(0, 30) || progress,
        time: formatTime(course.updatedAt),
        icon: "GraduationCap",
        url: `/courses/${course.id}`,
      });
    }

    // 2. 最近会话 (conversations) - 排除空会话
    const chats = await db
      .select({
        id: conversations.id,
        title: conversations.title,
        messageCount: conversations.messageCount,
        lastMessageAt: conversations.lastMessageAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          gt(conversations.messageCount, 0),
          eq(conversations.isArchived, false),
        ),
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit);

    for (const chat of chats) {
      items.push({
        id: chat.id,
        type: "chat",
        title: chat.title,
        desc: `${chat.messageCount} 条消息`,
        time: formatTime(chat.lastMessageAt),
        icon: "MessageSquare",
        url: `/chat/${chat.id}`,
      });
    }

    // 3. 最近文档 (documents)
    const docs = await db
      .select({
        id: documents.id,
        title: documents.title,
        plainText: documents.plainText,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(eq(documents.createdAt, documents.createdAt)) // TODO: 添加 userId
      .orderBy(desc(documents.updatedAt))
      .limit(limit);

    for (const doc of docs) {
      const preview = doc.plainText?.slice(0, 30) || "空文档";
      items.push({
        id: doc.id,
        type: "note",
        title: doc.title,
        desc: preview + (preview.length >= 30 ? "..." : ""),
        time: formatTime(doc.updatedAt),
        icon: "FileText",
        url: `/editor/${doc.id}`,
      });
    }

    // 4. 最近闪卡复习 (通过 reviewLogs 的最新记录找)
    // TODO: 添加闪卡活动查询

    // 按时间排序并限制数量
    items.sort((a, b) => {
      // 简单排序：较新的时间排在前面
      const timeOrder = ["刚刚", "分钟前", "小时前", "昨天", "天前", "周前", "月前"];
      const aTime = a.time.replace(/[0-9]+/, "").replace("前", "");
      const bTime = b.time.replace(/[0-9]+/, "").replace("前", "");
      return timeOrder.indexOf(aTime) - timeOrder.indexOf(bTime);
    });

    return NextResponse.json({ items: items.slice(0, limit) });
  } catch (error) {
    console.error("[RecentActivity] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch recent activity" }, { status: 500 });
  }
}

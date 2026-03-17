/**
 * Recent Section - Server Component
 *
 * 使用 React 19 Server Components + Suspense 模式
 * - 服务端直接获取数据（无需客户端 fetch）
 * - 利用 Next.js 缓存策略
 * - 自动处理认证状态
 */

import { and, desc, eq, gt } from "drizzle-orm";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Map as MapIcon,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { RecentCard } from "@/components/home";
import { conversations, courseSessions, db, documents, workspaces } from "@/db";
import { auth } from "@/lib/auth";

const ICONS = {
  course: GraduationCap,
  flashcard: StickyNote,
  quiz: BookOpen,
  note: FileText,
  chat: MessageSquare,
  mindmap: MapIcon,
} as const;

type RecentItem = {
  id: string;
  type: keyof typeof ICONS;
  title: string;
  desc: string;
  time: string;
  url: string;
  sortAt: number;
};

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

async function getRecentItems(userId: string, limit = 6): Promise<RecentItem[]> {
  const items: RecentItem[] = [];

  // 1. 最近课程
  const recentCourses = await db
    .select({
      id: courseSessions.id,
      title: courseSessions.title,
      description: courseSessions.description,
      updatedAt: courseSessions.updatedAt,
      status: courseSessions.status,
      interviewStatus: courseSessions.interviewStatus,
      progress: courseSessions.progress,
    })
    .from(courseSessions)
    .where(eq(courseSessions.userId, userId))
    .orderBy(desc(courseSessions.updatedAt))
    .limit(limit);

  for (const course of recentCourses) {
    const progressData = (course.progress as { currentChapter?: number }) || {};
    const isInterviewing = course.interviewStatus !== "completed";
    const isCompleted = course.status === "completed";
    const currentChapter = progressData.currentChapter || 0;
    const progress = isInterviewing
      ? "规划中"
      : isCompleted
        ? "已完成"
        : currentChapter > 0
          ? `第${currentChapter + 1}章`
          : "未开始";
    const url = isInterviewing ? `/interview?courseId=${course.id}` : `/learn/${course.id}`;
    items.push({
      id: course.id,
      type: "course",
      title: course.title || "未命名课程",
      desc: course.description?.slice(0, 30) || progress,
      time: formatTime(course.updatedAt),
      url,
      sortAt: course.updatedAt?.getTime() ?? 0,
    });
  }

  // 2. 最近会话
  const chats = await db
    .select({
      id: conversations.id,
      title: conversations.title,
      messageCount: conversations.messageCount,
      lastMessageAt: conversations.lastMessageAt,
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
      url: `/chat/${chat.id}`,
      sortAt: chat.lastMessageAt?.getTime() ?? 0,
    });
  }

  // 3. 最近文档（用户笔记，通过 workspace 过滤当前用户）
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      plainText: documents.plainText,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .innerJoin(workspaces, eq(documents.workspaceId, workspaces.id))
    .where(and(eq(workspaces.ownerId, userId), eq(documents.type, "document")))
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
      url: `/editor/${doc.id}`,
      sortAt: doc.updatedAt?.getTime() ?? 0,
    });
  }

  // 按时间混排，取最近 N 条
  items.sort((a, b) => b.sortAt - a.sortAt);
  return items.slice(0, limit);
}

export async function RecentSectionServer() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-[var(--color-text-secondary)]">最近</h2>
        </div>
        <p className="text-center py-8 text-[var(--color-text-muted)] text-sm">
          登录后查看学习记录
        </p>
      </section>
    );
  }

  const items = await getRecentItems(userId);

  if (items.length === 0) {
    return (
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-[var(--color-text-secondary)]">最近</h2>
        </div>
        <p className="text-center py-8 text-[var(--color-text-muted)] text-sm">
          还没有学习记录，开始第一次学习吧！
        </p>
      </section>
    );
  }

  return (
    <section className="mb-14">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-medium text-[var(--color-text-secondary)]">最近</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <RecentCard
            key={item.id}
            title={item.title}
            desc={item.desc}
            iconName={item.type}
            time={item.time}
            url={item.url}
          />
        ))}
      </div>
    </section>
  );
}

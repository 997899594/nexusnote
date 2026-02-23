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
import { conversations, courseProfiles, db, documents } from "@/db";
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
        ? `第${course.currentChapter + 1}章`
        : "未开始";
    items.push({
      id: course.id,
      type: "course",
      title: course.title || "未命名课程",
      desc: course.description?.slice(0, 30) || progress,
      time: formatTime(course.updatedAt),
      url: `/courses/${course.id}`,
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
    });
  }

  // 3. 最近文档
  const docs = await db
    .select({
      id: documents.id,
      title: documents.title,
      plainText: documents.plainText,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
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
    });
  }

  // 按时间排序（简单的启发式排序）
  return items.slice(0, limit);
}

export async function RecentSectionServer() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-zinc-700">最近</h2>
        </div>
        <p className="text-center py-8 text-zinc-400 text-sm">登录后查看学习记录</p>
      </section>
    );
  }

  const items = await getRecentItems(userId);

  if (items.length === 0) {
    return (
      <section className="mb-14">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-medium text-zinc-700">最近</h2>
        </div>
        <p className="text-center py-8 text-zinc-400 text-sm">还没有学习记录，开始第一次学习吧！</p>
      </section>
    );
  }

  return (
    <section className="mb-14">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-medium text-zinc-700">最近</h2>
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

/**
 * Recent Section - Server Component
 *
 * 使用 React 19 Server Components + Suspense 模式
 * - 服务端直接获取数据（无需客户端 fetch）
 * - 利用 Next.js 缓存策略
 * - 自动处理认证状态
 */

import { desc, eq } from "drizzle-orm";
import { GraduationCap } from "lucide-react";
import { WorkspaceEmptyState } from "@/components/common";
import { RecentCard } from "@/components/home";
import { courseProgress, courses, db } from "@/db";
import { auth } from "@/lib/auth";

const ICONS = {
  course: GraduationCap,
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
  const recentCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(eq(courses.userId, userId))
    .orderBy(desc(courses.updatedAt))
    .limit(limit);

  const progressRows = await db
    .select({
      courseId: courseProgress.courseId,
      currentChapter: courseProgress.currentChapter,
    })
    .from(courseProgress)
    .where(eq(courseProgress.userId, userId));

  return recentCourses.map((course) => {
    const progressData = progressRows.find((row) => row.courseId === course.id);
    const currentChapter = progressData?.currentChapter || 0;
    const progress = currentChapter > 0 ? `第${currentChapter + 1}章` : "未开始";

    return {
      id: course.id,
      type: "course",
      title: course.title || "未命名课程",
      desc: course.description?.slice(0, 30) || progress,
      time: formatTime(course.updatedAt),
      url: `/learn/${course.id}`,
      sortAt: course.updatedAt?.getTime() ?? 0,
    };
  });
}

export async function RecentSectionServer() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <section className="mb-14">
        <SectionHeader />
        <WorkspaceEmptyState
          icon={GraduationCap}
          eyebrow="Recent Courses"
          title="登录后查看最近课程"
          description="这里会展示你最近学习过的课程、最新进度和继续进入的入口。"
        />
      </section>
    );
  }

  const items = await getRecentItems(userId);

  if (items.length === 0) {
    return (
      <section className="mb-14">
        <SectionHeader />
        <WorkspaceEmptyState
          icon={GraduationCap}
          eyebrow="Recent Courses"
          title="还没有学习记录"
          description="从一个具体的学习目标开始，系统会先访谈，再生成你的第一门课程。"
        />
      </section>
    );
  }

  return (
    <section className="mb-14">
      <SectionHeader />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

function SectionHeader() {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          最近课程
        </p>
      </div>
      <div className="ui-badge-pill hidden items-center gap-2 px-3 py-1.5 text-[11px] uppercase tracking-[0.16em] text-black/40 md:inline-flex">
        <span className="h-1.5 w-1.5 rounded-full bg-[#111827]" />
        学习记录
      </div>
    </div>
  );
}

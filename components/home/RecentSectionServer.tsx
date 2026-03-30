/**
 * Recent Section - Server Component
 *
 * 使用 React 19 Server Components + Suspense 模式
 * - 服务端直接获取数据（无需客户端 fetch）
 * - 利用 Next.js 缓存策略
 * - 自动处理认证状态
 */

import { WorkspaceEmptyState } from "@/components/common";
import { RecentCard } from "@/components/home";
import { auth } from "@/lib/auth";
import { getRecentItemsCached } from "@/lib/server/home-data";

export async function RecentSectionServer() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <section className="mb-14">
        <SectionHeader />
        <WorkspaceEmptyState
          iconName="graduation-cap"
          eyebrow="Recent Courses"
          title="登录后查看最近课程"
          description="这里会展示你最近学习过的课程、最新进度和继续进入的入口。"
        />
      </section>
    );
  }

  const items = await getRecentItemsCached(userId);

  if (items.length === 0) {
    return (
      <section className="mb-14">
        <SectionHeader />
        <WorkspaceEmptyState
          iconName="graduation-cap"
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

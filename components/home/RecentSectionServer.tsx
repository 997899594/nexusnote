import { WorkspaceEmptyState } from "@/components/common";
import { getDynamicPageSession } from "@/lib/auth/page";
import { getRecentItemsCached } from "@/lib/learning/recent-courses-data";
import { RecentCard } from "./RecentCard";

function SectionHeader() {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-medium text-[var(--color-text)]">最近课程</h2>
    </div>
  );
}

export function RecentSectionSkeleton() {
  return (
    <section className="mb-14">
      <div className="mb-5">
        <div className="h-5 w-20 animate-pulse rounded-full bg-[var(--color-active)]" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="ui-surface-card h-36 animate-pulse rounded-[28px] bg-[var(--color-panel-soft)]"
          />
        ))}
      </div>
    </section>
  );
}

function RecentGuestState() {
  return (
    <section className="mb-14">
      <SectionHeader />
      <WorkspaceEmptyState
        iconName="graduation-cap"
        title="登录后查看最近课程"
        description="登录后继续上次的课程。"
      />
    </section>
  );
}

function RecentEmptyState() {
  return (
    <section className="mb-14">
      <SectionHeader />
      <WorkspaceEmptyState
        iconName="graduation-cap"
        title="还没有学习记录"
        description="从一个具体学习目标开始，先访谈，再生成第一门课程。"
      />
    </section>
  );
}

export async function RecentSectionServer() {
  const session = await getDynamicPageSession();

  if (!session?.user?.id) {
    return <RecentGuestState />;
  }

  const items = await getRecentItemsCached(session.user.id);

  if (items.length === 0) {
    return <RecentEmptyState />;
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

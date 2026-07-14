import { WorkspaceEmptyState } from "@/components/common";
import { HeroInput } from "@/components/home/HeroInput";
import { LearningMomentumHero } from "@/components/home/LearningMomentumHero";
import { getRecentLearningItemsCached } from "@/lib/learning/recent-courses-data";
import { RecentCard } from "./RecentCard";

function CoursePlanner({ primary = false }: { primary?: boolean }) {
  return (
    <section className={primary ? "mb-10 md:mb-12" : "mt-12 mb-14"}>
      <div className="mb-4">
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          {primary ? "规划第一门课程" : "规划下一门课程"}
        </h2>
        <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">
          先说明目标、期限和使用场景，再生成可执行的课程蓝图。
        </p>
      </div>
      <HeroInput />
    </section>
  );
}

export function RecentSectionSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mb-10 border-y border-black/[0.05] py-9">
        <div className="h-4 w-20 animate-pulse rounded bg-black/[0.05]" />
        <div className="mt-5 h-9 max-w-xl animate-pulse rounded bg-black/[0.05]" />
        <div className="mt-5 h-2 max-w-2xl animate-pulse rounded bg-black/[0.05]" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-48 animate-pulse rounded-lg bg-black/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export async function RecentSectionServer({ userId }: { userId: string }) {
  const items = await getRecentLearningItemsCached(userId);
  const primary = items.find((item) => item.status !== "completed") ?? null;
  const recentItems = primary ? items.filter((item) => item.id !== primary.id) : items;

  if (items.length === 0) {
    return (
      <>
        <CoursePlanner primary />
        <WorkspaceEmptyState
          iconName="graduation-cap"
          title="还没有学习记录"
          description="完成课程访谈并生成蓝图后，学习进度会出现在这里。"
        />
      </>
    );
  }

  return (
    <>
      {primary ? <LearningMomentumHero item={primary} /> : <CoursePlanner primary />}

      {recentItems.length > 0 ? (
        <section className="mb-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text)]">最近学习</h2>
              <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                进度按已读内容实时计算
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentItems.map((item) => (
              <RecentCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      ) : null}

      {primary ? <CoursePlanner /> : null}
    </>
  );
}

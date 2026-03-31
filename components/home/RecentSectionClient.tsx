"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { WorkspaceEmptyState } from "@/components/common";
import type { RecentItem } from "@/lib/server/home-data";
import { RecentCard } from "./RecentCard";

interface RecentItemsResponse {
  items: RecentItem[];
}

export function RecentSectionClient() {
  const { status } = useSession();
  const [items, setItems] = useState<RecentItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      setItems(null);
      setError(false);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch("/api/home/recent", {
          credentials: "same-origin",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Failed to load recent items: ${response.status}`);
        }

        const payload = (await response.json()) as RecentItemsResponse;
        setItems(payload.items);
        setError(false);
      } catch (loadError) {
        if (controller.signal.aborted) {
          return;
        }

        console.error("Failed to load recent items", loadError);
        setItems([]);
        setError(true);
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [status]);

  if (status === "loading" || (status === "authenticated" && items === null)) {
    return <RecentSkeletonState />;
  }

  if (status !== "authenticated") {
    return <RecentGuestState />;
  }

  if (!items?.length) {
    return <RecentEmptyState error={error} />;
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

function RecentGuestState() {
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

function RecentEmptyState({ error }: { error: boolean }) {
  return (
    <section className="mb-14">
      <SectionHeader />
      <WorkspaceEmptyState
        iconName="graduation-cap"
        eyebrow="Recent Courses"
        title={error ? "最近课程加载失败" : "还没有学习记录"}
        description={
          error
            ? "暂时无法获取最近学习记录，你仍然可以继续创建新的学习目标。"
            : "从一个具体的学习目标开始，系统会先访谈，再生成你的第一门课程。"
        }
      />
    </section>
  );
}

function RecentSkeletonState() {
  return (
    <section className="mb-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="h-3 w-20 animate-pulse rounded-full bg-black/8" />
          <div className="mt-3 h-7 w-28 animate-pulse rounded-full bg-black/10" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded-full bg-black/8" />
        </div>
        <div className="hidden h-8 w-20 animate-pulse rounded-full bg-black/8 md:block" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="ui-surface-card h-36 animate-pulse rounded-[28px] bg-black/[0.035]"
          />
        ))}
      </div>
    </section>
  );
}

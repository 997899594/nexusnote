/**
 * SkillGraph Skeleton - 加载状态骨架屏
 */

export function SkillGraphSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-100">
        <div className="h-6 bg-zinc-200 rounded w-32 animate-pulse" />
        <div className="h-4 bg-zinc-100 rounded w-48 mt-2 animate-pulse" />
      </div>

      {/* Graph area */}
      <div className="h-[350px] bg-zinc-50 flex items-center justify-center">
        <div className="animate-pulse text-zinc-300">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-zinc-100 flex gap-4">
        <div className="h-3 w-12 bg-zinc-100 rounded animate-pulse" />
        <div className="h-3 w-12 bg-zinc-100 rounded animate-pulse" />
        <div className="h-3 w-12 bg-zinc-100 rounded animate-pulse" />
      </div>
    </div>
  );
}

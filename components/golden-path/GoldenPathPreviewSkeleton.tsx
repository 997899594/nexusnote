export function GoldenPathPreviewSkeleton() {
  return (
    <div className="ui-surface-card overflow-hidden rounded-[28px] p-6 md:p-7">
      <div className="h-3 w-24 animate-pulse rounded-full bg-black/10" />
      <div className="mt-4 h-9 w-48 animate-pulse rounded-full bg-black/10" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded-full bg-black/8" />

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <div key={item} className="rounded-2xl bg-black/[0.035] p-4">
            <div className="h-3 w-16 animate-pulse rounded-full bg-black/8" />
            <div className="mt-3 h-7 w-12 animate-pulse rounded-full bg-black/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

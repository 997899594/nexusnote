export function GoldenPathPreviewSkeleton() {
  return (
    <div className="overflow-hidden rounded-[30px] border border-[#2a2419] bg-[linear-gradient(180deg,#11100d_0%,#16130f_100%)] p-6 md:p-7">
      <div className="h-3 w-24 animate-pulse rounded-full bg-white/10" />
      <div className="mt-4 h-9 w-56 animate-pulse rounded-full bg-white/10" />
      <div className="mt-3 h-4 w-80 animate-pulse rounded-full bg-white/8" />

      <div className="mt-6 rounded-[28px] border border-white/8 bg-white/[0.03] p-4">
        <div className="h-[240px] rounded-[24px] bg-black/15 p-4">
          <div className="mx-auto h-16 w-56 animate-pulse rounded-[24px] bg-white/10" />
          <div className="mt-10 flex justify-between gap-4">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-14 flex-1 animate-pulse rounded-[20px] bg-white/8" />
            ))}
          </div>
          <div className="mt-14 flex flex-wrap justify-center gap-2">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="h-8 w-24 animate-pulse rounded-full bg-white/8" />
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <div className="h-3 w-16 animate-pulse rounded-full bg-white/8" />
            <div className="mt-3 h-7 w-28 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="rounded-2xl bg-white/[0.04] p-4">
            <div className="h-3 w-20 animate-pulse rounded-full bg-white/8" />
            <div className="mt-3 space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="h-12 animate-pulse rounded-2xl bg-white/8" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

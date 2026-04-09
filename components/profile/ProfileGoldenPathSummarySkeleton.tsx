export function ProfileGoldenPathSummarySkeleton() {
  return (
    <section className="ui-surface-card-lg rounded-3xl p-5 md:p-7">
      <div className="animate-pulse">
        <div className="h-3 w-24 rounded-full bg-[var(--color-hover)]" />
        <div className="mt-4 h-8 w-56 rounded-2xl bg-[var(--color-hover)]" />
        <div className="mt-3 h-5 w-3/4 rounded-2xl bg-[var(--color-hover)]" />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="h-36 rounded-3xl bg-[var(--color-hover)]" />
          <div className="h-36 rounded-3xl bg-[var(--color-hover)]" />
        </div>
      </div>
    </section>
  );
}

export function ProfileCareerTreeSummarySkeleton() {
  return (
    <section className="ui-surface-card-lg overflow-hidden border border-black/6 p-5 md:p-6">
      <div className="animate-pulse">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="h-3 w-16 rounded-full bg-[var(--color-panel-soft)]" />
            <div className="mt-3 h-6 w-52 rounded-full bg-[var(--color-panel-soft)]" />
          </div>
          <div className="h-4 w-10 rounded-full bg-[var(--color-panel-soft)]" />
        </div>
        <div className="mt-3 h-4 w-3/4 rounded-full bg-[var(--color-panel-soft)]" />
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="h-32 rounded-2xl border border-black/6 bg-white" />
          <div className="h-32 rounded-2xl border border-black/6 bg-white" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-16 rounded-2xl bg-[var(--color-panel-soft)]" />
          ))}
        </div>
      </div>
    </section>
  );
}

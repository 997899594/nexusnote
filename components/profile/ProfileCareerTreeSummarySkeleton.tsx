export function ProfileCareerTreeSummarySkeleton() {
  return (
    <section className="overflow-hidden rounded-[2rem] border border-[#2e2419] bg-[linear-gradient(180deg,#111111_0%,#08090a_100%)] p-5 md:p-7">
      <div className="animate-pulse">
        <div className="h-3 w-24 bg-[#2c2117]" />
        <div className="mt-4 h-8 w-64 bg-[#2c2117]" />
        <div className="mt-3 h-5 w-3/4 bg-[#2c2117]" />
        <div className="mt-6 rounded-[1.5rem] border border-[#2a2016] bg-[#0a0908]/78 p-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <div className="h-3 w-3 rotate-45 bg-[#4b351b]" />
              <div className="mt-4 h-4 w-28 bg-[#2c2117]" />
            </div>
            <div>
              <div className="h-2.5 w-2.5 rotate-45 bg-[#332617]" />
              <div className="mt-4 h-4 w-24 bg-[#211911]" />
            </div>
            <div>
              <div className="h-2.5 w-2.5 rotate-45 bg-[#332617]" />
              <div className="mt-4 h-4 w-24 bg-[#211911]" />
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-[1.5rem] border border-[#2a2016] bg-[#080807]/72">
          <div className="h-10 border-b border-[#2a2016] px-4 py-3">
            <div className="h-3 w-20 bg-[#2c2117]" />
          </div>
          <div className="divide-y divide-[#241b12]">
            {[0, 1, 2].map((item) => (
              <div key={item} className="grid gap-3 px-4 py-3 md:grid-cols-[2.25rem_1fr_auto]">
                <div className="h-8 w-8 bg-[#211911]" />
                <div>
                  <div className="h-4 w-36 bg-[#2c2117]" />
                  <div className="mt-2 h-3 w-full bg-[#211911]" />
                </div>
                <div className="h-4 w-20 bg-[#2c2117]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

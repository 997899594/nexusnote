import { ArrowRight, CalendarCheck2, Check, Play, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import type { LearningActivationJourney, LearningActivationStage } from "@/lib/learning/activation";
import { cn } from "@/lib/utils";

const STEPS: Array<{
  stage: Exclude<LearningActivationStage, "not_generated">;
  label: string;
  shortLabel: string;
  icon: typeof Sparkles;
}> = [
  { stage: "generated", label: "课程已生成", shortLabel: "生成", icon: Sparkles },
  { stage: "started", label: "已经开学", shortLabel: "开学", icon: Play },
  { stage: "first_completion", label: "首次完成", shortLabel: "首篇", icon: Check },
  { stage: "continued", label: "跨过首周", shortLabel: "首周", icon: CalendarCheck2 },
  { stage: "completed", label: "课程完成", shortLabel: "完成", icon: Trophy },
];

export function LearningActivationJourneyView({ journey }: { journey: LearningActivationJourney }) {
  const currentIndex = STEPS.findIndex((step) => step.stage === journey.stage);

  return (
    <section className="border-y border-black/[0.06] py-6">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-tertiary)]">
            <Sparkles className="h-4 w-4" />
            学习激活路径
          </div>
          <h2 className="mt-2 truncate text-xl font-semibold text-[var(--color-text)]">
            {journey.courseTitle ?? "从第一门课程开始"}
          </h2>

          <ol className="mt-6 grid grid-cols-5 gap-2" aria-label="学习激活进度">
            {STEPS.map((step, index) => {
              const reached = currentIndex >= index;
              const current = currentIndex === index;
              return (
                <li
                  key={step.stage}
                  className="min-w-0"
                  aria-current={current ? "step" : undefined}
                >
                  <div
                    className={cn(
                      "mb-2 h-1 w-full bg-black/[0.06]",
                      reached && "bg-[var(--color-accent)]",
                    )}
                  />
                  <div
                    className={cn(
                      "flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]",
                      reached && "font-medium text-[var(--color-text)]",
                    )}
                  >
                    <step.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="sm:hidden">{step.shortLabel}</span>
                    <span className="hidden truncate sm:inline">{step.label}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="max-w-sm shrink-0 xl:text-right">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
            {journey.actionDescription}
          </p>
          <Link
            href={journey.href}
            className="ui-primary-button mt-3 inline-flex min-h-10 items-center rounded-lg px-4 py-2 text-sm font-medium"
          >
            {journey.actionLabel}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

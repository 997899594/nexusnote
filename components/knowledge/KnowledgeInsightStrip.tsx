import { AlertCircle, Brain, Compass, type LucideIcon, Sparkles, TrendingUp } from "lucide-react";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { cn } from "@/lib/utils";

const KIND_META: Record<
  KnowledgeInsight["kind"],
  {
    label: string;
    icon: LucideIcon;
  }
> = {
  theme: {
    label: "主题",
    icon: Sparkles,
  },
  strength: {
    label: "优势",
    icon: TrendingUp,
  },
  gap: {
    label: "待补",
    icon: AlertCircle,
  },
  trajectory: {
    label: "走向",
    icon: Compass,
  },
  recommendation_reason: {
    label: "依据",
    icon: Brain,
  },
};

interface KnowledgeInsightStripProps {
  insights: KnowledgeInsight[];
  className?: string;
}

export function KnowledgeInsightStrip({ insights, className }: KnowledgeInsightStripProps) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid gap-3 md:grid-cols-3", className)}>
      {insights.map((insight) => {
        const meta = KIND_META[insight.kind];
        const Icon = meta.icon;

        return (
          <article
            key={insight.id}
            className="rounded-[24px] border border-black/6 bg-white/88 px-4 py-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.28)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </div>
              <div className="text-[11px] font-medium text-[var(--color-text-muted)]">
                {Math.round(insight.confidence * 100)}%
              </div>
            </div>
            <div className="mt-3 text-sm font-medium leading-6 text-[var(--color-text)]">
              {insight.title}
            </div>
            <p className="mt-2 line-clamp-3 text-xs leading-6 text-[var(--color-text-tertiary)]">
              {insight.summary}
            </p>
          </article>
        );
      })}
    </div>
  );
}

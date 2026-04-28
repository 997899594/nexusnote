import { AlertCircle, Brain, Compass, type LucideIcon, Sparkles, TrendingUp } from "lucide-react";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { getKnowledgeInsightKindLabel } from "@/lib/knowledge/presentation";
import { cn } from "@/lib/utils";

const KIND_ICONS: Record<KnowledgeInsight["kind"], LucideIcon> = {
  theme: Sparkles,
  strength: TrendingUp,
  gap: AlertCircle,
  trajectory: Compass,
  recommendation_reason: Brain,
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
        const Icon = KIND_ICONS[insight.kind];

        return (
          <article key={insight.id} className="ui-message-card rounded-[24px] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                <Icon className="h-3.5 w-3.5" />
                {getKnowledgeInsightKindLabel(insight.kind)}
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

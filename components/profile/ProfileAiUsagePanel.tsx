"use client";

import {
  Activity,
  Brain,
  Flame,
  Layers3,
  Orbit,
  Radar,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { type ComponentType, useState } from "react";

interface UsageBreakdownItem {
  key: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

interface UsageDailyItem {
  dayKey: string;
  label: string;
  requestCount: number;
  totalTokens: number;
  totalCost: number;
}

interface ProfileAiUsagePanelProps {
  usage: {
    requestCount: number;
    totalTokens: number;
    totalCost: number;
    activeDays: number;
    avgTokensPerRequest: number;
    avgCostPerRequest: number;
    peakDay: UsageDailyItem | null;
    daily: UsageDailyItem[];
    byPolicy: UsageBreakdownItem[];
    byWorkflow: UsageBreakdownItem[];
    byProvider: UsageBreakdownItem[];
  };
  windowStartLabel: string;
}

type TrendMode = "requests" | "tokens" | "cost";
type UsageKind = "policy" | "workflow" | "provider";

const POLICY_LABELS: Record<string, string> = {
  "interactive-fast": "交互快速",
  "structured-high-quality": "结构高质量",
  "search-enabled": "联网检索",
};

const WORKFLOW_LABELS: Record<string, string> = {
  "notes:tag-generation": "标签生成",
  "ai-eval-judge": "AI 评测",
  "conversation-title-generation": "标题生成",
  "query-rewrite": "检索改写",
  "style-analysis": "风格分析",
  "interview-agent": "课程访谈",
  "generate-course-section": "课程章节生成",
};

const PROVIDER_LABELS: Record<string, string> = {
  "302.ai": "302.ai",
};

function formatCompactTokens(totalTokens: number): string {
  return totalTokens >= 1000
    ? `${(totalTokens / 1000).toFixed(1)}k`
    : String(Math.round(totalTokens));
}

function formatCompactCost(totalCost: number): string {
  return totalCost >= 1 ? `$${totalCost.toFixed(2)}` : `$${totalCost.toFixed(3)}`;
}

function formatUsageShare(value: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}

function getDailyValue(item: UsageDailyItem, mode: TrendMode): number {
  switch (mode) {
    case "tokens":
      return item.totalTokens;
    case "cost":
      return item.totalCost;
    default:
      return item.requestCount;
  }
}

function formatDailyPrimary(item: UsageDailyItem, mode: TrendMode): string {
  switch (mode) {
    case "tokens":
      return formatCompactTokens(item.totalTokens);
    case "cost":
      return formatCompactCost(item.totalCost);
    default:
      return String(item.requestCount);
  }
}

function formatDailySecondary(item: UsageDailyItem, mode: TrendMode): string {
  switch (mode) {
    case "tokens":
      return `${item.requestCount} 次`;
    case "cost":
      return formatCompactTokens(item.totalTokens);
    default:
      return formatCompactTokens(item.totalTokens);
  }
}

function getTrendLabel(mode: TrendMode): string {
  switch (mode) {
    case "tokens":
      return "Token 强度";
    case "cost":
      return "成本趋势";
    default:
      return "请求量";
  }
}

function humanizeUsageIdentifier(value: string): string {
  return value
    .replace(/[:/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getAIUsageLabel(value: string, kind: UsageKind | "generic" = "generic"): string {
  const normalized = value.trim();
  if (!normalized) {
    return "未知";
  }

  if (kind === "policy") {
    return POLICY_LABELS[normalized] ?? humanizeUsageIdentifier(normalized);
  }

  if (kind === "workflow") {
    return WORKFLOW_LABELS[normalized] ?? humanizeUsageIdentifier(normalized);
  }

  if (kind === "provider") {
    return PROVIDER_LABELS[normalized] ?? normalized;
  }

  return (
    POLICY_LABELS[normalized] ??
    WORKFLOW_LABELS[normalized] ??
    PROVIDER_LABELS[normalized] ??
    humanizeUsageIdentifier(normalized)
  );
}

function TrendToggle({ mode, onChange }: { mode: TrendMode; onChange: (mode: TrendMode) => void }) {
  const items: Array<{ key: TrendMode; label: string }> = [
    { key: "requests", label: "请求" },
    { key: "tokens", label: "Token" },
    { key: "cost", label: "成本" },
  ];

  return (
    <div className="ui-badge-pill inline-flex border border-black/5 p-1">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={
            item.key === mode
              ? "ui-primary-button rounded-full px-3 py-1 text-[11px] font-medium transition-colors"
              : "rounded-full px-3 py-1 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text)]"
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function UsageMetricCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-[var(--color-panel-soft)] p-4 md:p-5">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="ui-icon-chip flex h-10 w-10 flex-shrink-0 items-center justify-center md:h-12 md:w-12">
          <Icon className="h-5 w-5 text-[var(--color-text-secondary)] md:h-6 md:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs text-[var(--color-text-tertiary)] md:text-sm">{label}</div>
          <div className="truncate text-base font-semibold text-[var(--color-text)] md:text-xl">
            {value}
          </div>
          <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{helper}</div>
        </div>
      </div>
    </div>
  );
}

function UsageBreakdownPanel({
  icon: Icon,
  title,
  kind,
  items,
  totalRequests,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  kind: UsageKind;
  items: UsageBreakdownItem[];
  totalRequests: number;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-[var(--color-panel-soft)] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => {
            const share = totalRequests > 0 ? item.requestCount / totalRequests : 0;

            return (
              <div key={item.key} className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-[var(--color-text)]">
                      {getAIUsageLabel(item.key, kind)}
                    </div>
                    <div className="text-xs text-[var(--color-text-tertiary)]">
                      {formatCompactTokens(item.totalTokens)} tokens
                    </div>
                  </div>
                  <div className="text-right text-xs text-[var(--color-text-secondary)]">
                    <div>{formatUsageShare(item.requestCount, totalRequests)}</div>
                    <div>
                      {item.requestCount} 次 · {formatCompactCost(item.totalCost)}
                    </div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,var(--color-panel-strong)_0%,var(--color-text-secondary)_100%)]"
                    style={{ width: `${Math.max(8, share * 100)}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">最近 7 天暂无数据</p>
        )}
      </div>
    </div>
  );
}

export function ProfileAiUsagePanel({ usage, windowStartLabel }: ProfileAiUsagePanelProps) {
  const [mode, setMode] = useState<TrendMode>("requests");
  const dominantPolicy = usage.byPolicy[0] ?? null;
  const dominantWorkflow = usage.byWorkflow[0] ?? null;
  const dominantProvider = usage.byProvider[0] ?? null;
  const maxDailyValue = Math.max(1, ...usage.daily.map((item) => getDailyValue(item, mode)));

  return (
    <div className="ui-surface-card rounded-2xl p-6 md:p-7">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
        <UsageMetricCard
          icon={Zap}
          label="请求数"
          value={usage.requestCount}
          helper={`${usage.activeDays} / 7 天有 AI 活动`}
        />
        <UsageMetricCard
          icon={TrendingUp}
          label="Token 数"
          value={formatCompactTokens(usage.totalTokens)}
          helper={`平均每次 ${formatCompactTokens(usage.avgTokensPerRequest)}`}
        />
        <UsageMetricCard
          icon={Target}
          label="预估花费"
          value={formatCompactCost(usage.totalCost)}
          helper={`平均每次 ${formatCompactCost(usage.avgCostPerRequest)}`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:mt-6 md:grid-cols-3">
        <UsageMetricCard
          icon={Activity}
          label="使用密度"
          value={`${usage.activeDays} 天`}
          helper={usage.activeDays >= 5 ? "最近一周使用频率较高" : "最近一周使用频率仍有提升空间"}
        />
        <UsageMetricCard
          icon={Flame}
          label="峰值日"
          value={
            usage.peakDay ? `${usage.peakDay.label} · ${usage.peakDay.requestCount} 次` : "暂无峰值"
          }
          helper={
            usage.peakDay
              ? `${formatCompactTokens(usage.peakDay.totalTokens)} tokens`
              : "最近 7 天还没有 AI 请求"
          }
        />
        <UsageMetricCard
          icon={Radar}
          label="主使用模式"
          value={dominantWorkflow ? getAIUsageLabel(dominantWorkflow.key, "workflow") : "暂无数据"}
          helper={
            dominantWorkflow
              ? `${formatUsageShare(dominantWorkflow.requestCount, usage.requestCount)} 的请求来自该工作流`
              : "等待更多使用记录"
          }
        />
      </div>

      <div className="ui-message-card mt-6 rounded-[28px] p-4 md:mt-8 md:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              Daily Trend
            </p>
            <h3 className="mt-1 text-sm font-medium text-[var(--color-text)] md:text-base">
              每日 AI 使用趋势
            </h3>
          </div>
          <TrendToggle mode={mode} onChange={setMode} />
        </div>

        <div className="ui-badge-pill mb-4 rounded-full px-3 py-1 text-[11px] text-[var(--color-text-secondary)]">
          当前视图：{getTrendLabel(mode)}
        </div>

        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {usage.daily.map((item) => {
            const barHeight = `${Math.max(12, (getDailyValue(item, mode) / maxDailyValue) * 100)}%`;

            return (
              <div key={item.dayKey} className="flex min-w-0 flex-col items-center gap-2">
                <div className="ui-message-card w-full rounded-2xl px-2 py-2 text-center">
                  <div className="truncate text-[11px] font-medium text-[var(--color-text)]">
                    {formatDailyPrimary(item, mode)}
                  </div>
                  <div className="truncate text-[10px] text-[var(--color-text-muted)]">
                    {formatDailySecondary(item, mode)}
                  </div>
                </div>
                <div className="flex h-32 w-full items-end rounded-[22px] bg-[var(--color-panel-soft)] px-2 py-2 md:h-40 md:px-3">
                  <div
                    className="w-full rounded-[16px] bg-[linear-gradient(180deg,var(--color-panel-strong)_0%,var(--color-text-secondary)_100%)] shadow-[var(--shadow-strong-button)] transition-all duration-300"
                    style={{ height: barHeight }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium text-[var(--color-text)]">{item.label}</div>
                  <div className="text-[10px] text-[var(--color-text-muted)]">
                    {mode === "cost"
                      ? `${item.requestCount} 次`
                      : formatCompactCost(item.totalCost)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="ui-message-card mt-6 rounded-2xl p-4 md:mt-8 md:p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="ui-message-card rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              主策略
            </div>
            <div className="mt-2 text-sm font-medium text-[var(--color-text)] md:text-base">
              {dominantPolicy ? getAIUsageLabel(dominantPolicy.key, "policy") : "暂无数据"}
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              {dominantPolicy
                ? `${formatUsageShare(dominantPolicy.requestCount, usage.requestCount)} 请求占比`
                : "等待更多策略使用记录"}
            </div>
          </div>
          <div className="ui-message-card rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              主工作流
            </div>
            <div className="mt-2 text-sm font-medium text-[var(--color-text)] md:text-base">
              {dominantWorkflow ? getAIUsageLabel(dominantWorkflow.key, "workflow") : "暂无数据"}
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              {dominantWorkflow
                ? `${formatCompactTokens(dominantWorkflow.totalTokens)} tokens`
                : "等待更多工作流使用记录"}
            </div>
          </div>
          <div className="ui-message-card rounded-2xl p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
              主要 Provider
            </div>
            <div className="mt-2 text-sm font-medium text-[var(--color-text)] md:text-base">
              {dominantProvider ? getAIUsageLabel(dominantProvider.key, "provider") : "暂无数据"}
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
              {dominantProvider
                ? `${formatCompactCost(dominantProvider.totalCost)} 预算消耗`
                : "等待更多 provider 使用记录"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-3">
        <UsageBreakdownPanel
          icon={Orbit}
          title="策略分布"
          kind="policy"
          items={usage.byPolicy}
          totalRequests={usage.requestCount}
        />
        <UsageBreakdownPanel
          icon={Layers3}
          title="工作流"
          kind="workflow"
          items={usage.byWorkflow}
          totalRequests={usage.requestCount}
        />
        <UsageBreakdownPanel
          icon={Brain}
          title="Provider"
          kind="provider"
          items={usage.byProvider}
          totalRequests={usage.requestCount}
        />
      </div>

      <p className="mt-5 text-xs text-[var(--color-text-muted)]">
        统计窗口起点：{windowStartLabel}
      </p>
    </div>
  );
}

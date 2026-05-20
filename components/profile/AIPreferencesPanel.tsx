"use client";

import { Brain, ChevronDown, Palette, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { SkinSelector } from "@/components/chat/SkinSelector";
import { useToast } from "@/components/ui/Toast";
import { AI_MODEL_SERIES_OPTIONS } from "@/lib/ai/core/model-series";
import { type AIPreferences, DEFAULT_AI_PREFERENCES } from "@/lib/ai/preferences";
import { cn } from "@/lib/utils";
import { useUserPreferencesStore } from "@/stores/user-preferences";

type LearningFormat = "text" | "video" | "mixed" | "audio" | "interactive";
type LearningPace = "slow" | "moderate" | "fast" | "adaptive";

const DEFAULT_LEARNING_STYLE = {
  preferredFormat: "mixed" as LearningFormat,
  pace: "moderate" as LearningPace,
};

export function AIPreferencesPanel() {
  const { addToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const profile = useUserPreferencesStore((state) => state.profile);
  const availableSkins = useUserPreferencesStore((state) => state.availableSkins);
  const currentSkinSlug = useUserPreferencesStore((state) => state.currentSkinSlug);
  const setCurrentSkin = useUserPreferencesStore((state) => state.setCurrentSkin);
  const saveProfilePreferences = useUserPreferencesStore((state) => state.saveProfilePreferences);

  const [form, setForm] = useState(() => ({
    learningStyle: profile?.learningStyle ?? DEFAULT_LEARNING_STYLE,
    aiPreferences: profile?.aiPreferences ?? DEFAULT_AI_PREFERENCES,
  }));

  useEffect(() => {
    setForm({
      learningStyle: profile?.learningStyle ?? DEFAULT_LEARNING_STYLE,
      aiPreferences: profile?.aiPreferences ?? DEFAULT_AI_PREFERENCES,
    });
  }, [profile]);

  const handleSave = () => {
    startTransition(async () => {
      try {
        await saveProfilePreferences(form);
        addToast("偏好已更新", "success");
      } catch (error) {
        console.error("[AIPreferencesPanel] Failed to save:", error);
        addToast("保存偏好失败", "error");
      }
    });
  };

  const updateAIPreference = <K extends keyof AIPreferences>(key: K, value: AIPreferences[K]) => {
    setForm((current) => ({
      ...current,
      aiPreferences: {
        ...current.aiPreferences,
        [key]: value,
      },
    }));
  };

  return (
    <section className="mb-8">
      <div className="mb-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          助手偏好
        </p>
        <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">讲解与学习方式</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-text-tertiary)]">
          这些设置会影响讲解方式、语气和课程内容的展开方式。
        </p>
      </div>

      <div className="ui-surface-card-lg rounded-3xl p-5 md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <PreferenceBlock
            icon={<Brain className="h-4 w-4" />}
            title="默认模型"
            description="决定对话、访谈和课程生成默认使用的模型。"
          >
            <SegmentedSelect
              value={form.aiPreferences.modelSeries}
              onChange={(value) =>
                updateAIPreference("modelSeries", value as AIPreferences["modelSeries"])
              }
              options={AI_MODEL_SERIES_OPTIONS.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </PreferenceBlock>

          <PreferenceBlock
            icon={<Brain className="h-4 w-4" />}
            title="讲解方式"
            description="选择更适合你的学习引导方式。"
          >
            <SegmentedSelect
              value={form.aiPreferences.teachingStyle}
              onChange={(value) =>
                updateAIPreference("teachingStyle", value as AIPreferences["teachingStyle"])
              }
              options={[
                { value: "explain", label: "讲解型" },
                { value: "coach", label: "教练型" },
                { value: "socratic", label: "启发型" },
              ]}
            />
          </PreferenceBlock>

          <PreferenceBlock
            icon={<Sparkles className="h-4 w-4" />}
            title="交流风格"
            description="调整回答语气、展开程度和呈现方式。"
          >
            <div className="space-y-4">
              <LabeledSelect
                label="语气"
                value={form.aiPreferences.tone}
                onChange={(value) => updateAIPreference("tone", value as AIPreferences["tone"])}
                options={[
                  { value: "direct", label: "直接" },
                  { value: "balanced", label: "平衡" },
                  { value: "gentle", label: "温和" },
                ]}
              />
              <LabeledSelect
                label="深度"
                value={form.aiPreferences.depth}
                onChange={(value) => updateAIPreference("depth", value as AIPreferences["depth"])}
                options={[
                  { value: "concise", label: "简洁" },
                  { value: "balanced", label: "平衡" },
                  { value: "detailed", label: "详细" },
                ]}
              />
              <LabeledSelect
                label="输出形式"
                value={form.aiPreferences.responseFormat}
                onChange={(value) =>
                  updateAIPreference("responseFormat", value as AIPreferences["responseFormat"])
                }
                options={[
                  { value: "structured", label: "条理清晰" },
                  { value: "balanced", label: "自然平衡" },
                  { value: "conversational", label: "更口语" },
                ]}
              />
            </div>
          </PreferenceBlock>

          <PreferenceBlock
            icon={<Palette className="h-4 w-4" />}
            title="默认皮肤"
            description="选择默认表达气质，不改变学习目标和能力范围。"
          >
            <SkinSelector
              skins={availableSkins}
              currentSkinSlug={currentSkinSlug}
              onSkinChange={(slug) => {
                void setCurrentSkin(slug);
              }}
              variant="radio"
            />
          </PreferenceBlock>

          <PreferenceBlock
            icon={<Brain className="h-4 w-4" />}
            title="学习偏好"
            description="决定课程内容默认以什么形式展开，以及默认学习节奏。"
          >
            <div className="space-y-4">
              <LabeledSelect
                label="偏好形式"
                value={form.learningStyle.preferredFormat ?? DEFAULT_LEARNING_STYLE.preferredFormat}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    learningStyle: {
                      ...current.learningStyle,
                      preferredFormat: value as LearningFormat,
                    },
                  }))
                }
                options={[
                  { value: "text", label: "文本" },
                  { value: "video", label: "视频" },
                  { value: "mixed", label: "混合" },
                  { value: "audio", label: "音频" },
                  { value: "interactive", label: "互动" },
                ]}
              />
              <LabeledSelect
                label="学习节奏"
                value={form.learningStyle.pace ?? DEFAULT_LEARNING_STYLE.pace}
                onChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    learningStyle: {
                      ...current.learningStyle,
                      pace: value as LearningPace,
                    },
                  }))
                }
                options={[
                  { value: "slow", label: "慢" },
                  { value: "moderate", label: "正常" },
                  { value: "fast", label: "快" },
                  { value: "adaptive", label: "自适应" },
                ]}
              />
            </div>
          </PreferenceBlock>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="ui-primary-button rounded-full px-5 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "保存中..." : "保存偏好"}
          </button>
        </div>
      </div>
    </section>
  );
}

function PreferenceBlock({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="ui-message-card rounded-3xl p-4 md:p-5">
      <div className="mb-4 flex items-center gap-2 text-[var(--color-text)]">
        <div className="ui-icon-chip flex h-8 w-8 items-center justify-center">{icon}</div>
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs leading-6 text-[var(--color-text-tertiary)]">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function SegmentedSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        options.length >= 4 ? "grid-cols-2 xl:grid-cols-4" : "grid-cols-3",
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-2xl px-3 py-3 text-sm transition-colors ${
            value === option.value
              ? "ui-primary-button"
              : "bg-[var(--color-panel-soft)] text-[var(--color-text-secondary)] hover:bg-[var(--color-active)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function LabeledSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-4">
      <span className="text-sm font-medium text-[var(--color-text-secondary)] md:min-w-20">
        {label}
      </span>
      <span className="group relative block md:w-[min(100%,16rem)]">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-11 w-full appearance-none rounded-full border border-black/8 bg-[var(--color-panel-soft)]",
            "px-4 pr-11 text-sm font-medium text-[var(--color-text)] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
            "outline-none transition-[border-color,background-color,box-shadow]",
            "hover:border-black/12 hover:bg-white",
            "focus:border-[var(--color-panel-strong)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.85)]",
          )}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-1 right-1 flex w-9 items-center justify-center rounded-full text-[var(--color-text-tertiary)] transition-colors group-hover:bg-white/75 group-hover:text-[var(--color-text-secondary)]">
          <ChevronDown className="h-4 w-4" />
        </span>
      </span>
    </label>
  );
}

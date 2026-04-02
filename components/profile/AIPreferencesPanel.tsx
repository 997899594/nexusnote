"use client";

import { Brain, Palette, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState, useTransition } from "react";
import { SkinSelector } from "@/components/chat/SkinSelector";
import { useToast } from "@/components/ui/Toast";
import { type AIPreferences, DEFAULT_AI_PREFERENCES } from "@/lib/ai/preferences";
import { useUserPreferencesStore } from "@/stores";

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
        addToast("AI 偏好已更新", "success");
      } catch (error) {
        console.error("[AIPreferencesPanel] Failed to save:", error);
        addToast("保存 AI 偏好失败", "error");
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
          AI 偏好
        </p>
        <h2 className="mt-2 text-xl font-medium text-[var(--color-text)]">默认行为与表达风格</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-[var(--color-text-tertiary)]">
          这里设置长期默认值。聊天、学习、笔记里仍然可以临时切换，但默认行为以这里为准。
        </p>
      </div>

      <div className="ui-surface-card-lg rounded-3xl p-5 md:p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <PreferenceBlock
            icon={<Brain className="h-4 w-4" />}
            title="讲解方式"
            description="决定 AI 是先讲清楚、先带练，还是更偏启发式。"
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
            description="控制语气强弱与展开深度，不改变事实标准和工具边界。"
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
                  { value: "structured", label: "结构化" },
                  { value: "balanced", label: "按需结构化" },
                  { value: "conversational", label: "更口语" },
                ]}
              />
            </div>
          </PreferenceBlock>

          <PreferenceBlock
            icon={<Palette className="h-4 w-4" />}
            title="默认皮肤"
            description="皮肤只影响表达气质与语言表层，不应覆盖助手能力、工具边界和学习目标。"
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
            {isPending ? "保存中..." : "保存 AI 偏好"}
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
    <div className="rounded-3xl border border-black/6 bg-white/70 p-4 md:p-5">
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
    <div className="grid grid-cols-3 gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-2xl px-3 py-3 text-sm transition-colors ${
            value === option.value
              ? "bg-[#111827] text-white"
              : "bg-[#f4f6f8] text-[var(--color-text-secondary)] hover:bg-[#eceff3]"
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
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[var(--color-text-secondary)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-black/8 bg-white px-4 py-3 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[#111827]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

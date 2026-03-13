/**
 * CourseOutlineCard - 课程大纲确认卡片
 *
 * 展示课程大纲并允许用户确认生成
 */

"use client";

import { Check, ExternalLink, GraduationCap, Loader2 } from "lucide-react";
import { useState } from "react";
import type { GenerateCourseOutput } from "./types";

interface CourseOutlineCardProps {
  output: GenerateCourseOutput;
}

export function CourseOutlineCard({ output }: CourseOutlineCardProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(!!output.courseId);

  if (!output.success) {
    return (
      <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
        <p className="text-sm text-red-600">{output.error || "课程生成失败"}</p>
      </div>
    );
  }

  const handleGenerate = async () => {
    if (output.courseId) {
      setIsGenerated(true);
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch("/api/courses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: output.title,
          chapters: output.chapters,
          outline: output.outline,
        }),
      });

      if (response.ok) {
        setIsGenerated(true);
      }
    } catch (error) {
      console.error("Failed to generate course:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerated) {
    return (
      <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <div className="flex items-center gap-2 mb-2">
          <Check className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-800 dark:text-green-200">
            课程创建成功
          </span>
        </div>
        {output.courseId && (
          <a
            href={`/learn/${output.courseId}`}
            className="inline-flex items-center gap-1 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent-hover)]"
          >
            <ExternalLink className="w-3 h-3" />
            查看课程
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-3">
        <GraduationCap className="w-4 h-4 text-purple-600" />
        <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
          课程大纲预览
        </span>
      </div>

      <h4 className="text-base font-semibold text-[var(--color-text)] mb-2">{output.title}</h4>

      {output.outline && (
        <div className="mb-3 space-y-2">
          {output.outline.chapters.map((chapter, index) => (
            <div
              key={`${chapter.title}-${index}`}
              className="p-2 bg-[var(--color-surface)] rounded text-xs"
            >
              <div className="font-medium text-[var(--color-text-secondary)]">
                第 {index + 1} 章: {chapter.title}
              </div>
              {chapter.description && (
                <div className="text-[var(--color-text-tertiary)] mt-1 line-clamp-2">
                  {chapter.description}
                </div>
              )}
              {chapter.sections && chapter.sections.length > 0 && (
                <div className="mt-2 space-y-1">
                  {chapter.sections.slice(0, 3).map((section, secIdx) => (
                    <div
                      key={`section-${index}-${secIdx}`}
                      className="text-xs text-[var(--color-text-secondary)]"
                    >
                      {index + 1}.{secIdx + 1} {section.title}
                    </div>
                  ))}
                  {chapter.sections.length > 3 && (
                    <span className="text-[var(--color-text-muted)] text-xs">
                      +{chapter.sections.length - 3} 节
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!output.outline && output.chapters && (
        <p className="text-xs text-[var(--color-text-tertiary)] mb-3">共 {output.chapters} 章</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          生成课程
        </button>
      </div>
    </div>
  );
}

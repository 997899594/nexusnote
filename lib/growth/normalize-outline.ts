import { createHash } from "node:crypto";
import { z } from "zod";

export const growthOutlineSectionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const growthOutlineChapterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
  sections: z.array(growthOutlineSectionSchema).optional(),
});

export const growthOutlineDataSchema = z.object({
  courseSkillIds: z.array(z.string()).optional(),
  chapters: z.array(growthOutlineChapterSchema).optional(),
});

export type GrowthOutlineData = z.infer<typeof growthOutlineDataSchema>;

export interface NormalizedGrowthOutlineSection {
  sectionKey: string;
  title: string;
  description: string;
}

export interface NormalizedGrowthOutlineChapter {
  chapterKey: string;
  chapterIndex: number;
  title: string;
  description: string;
  explicitSkillIds: string[];
  sections: NormalizedGrowthOutlineSection[];
}

export interface NormalizedGrowthOutline {
  courseSkillIds: string[];
  chapters: NormalizedGrowthOutlineChapter[];
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(objectValue[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function uniqueStrings(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeGrowthOutline(outlineInput: unknown): NormalizedGrowthOutline {
  const parsed = growthOutlineDataSchema.parse(outlineInput ?? {});

  return {
    courseSkillIds: uniqueStrings(parsed.courseSkillIds),
    chapters: (parsed.chapters ?? []).map((chapter, chapterIndex) => ({
      chapterKey: `chapter-${chapterIndex + 1}`,
      chapterIndex,
      title: chapter.title?.trim() || `第 ${chapterIndex + 1} 章`,
      description: chapter.description?.trim() || "",
      explicitSkillIds: uniqueStrings(chapter.skillIds),
      sections: (chapter.sections ?? []).map((section, sectionIndex) => ({
        sectionKey: `section-${chapterIndex + 1}-${sectionIndex + 1}`,
        title: section.title?.trim() || `第 ${chapterIndex + 1}.${sectionIndex + 1} 节`,
        description: section.description?.trim() || "",
      })),
    })),
  };
}

export function computeGrowthOutlineHash(outline: NormalizedGrowthOutline): string {
  return createHash("sha256").update(stableStringify(outline)).digest("hex");
}

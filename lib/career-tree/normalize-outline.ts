import { createHash } from "node:crypto";
import { z } from "zod";

export const careerOutlineSectionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const careerOutlineChapterSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  skillIds: z.array(z.string()).optional(),
  sections: z.array(careerOutlineSectionSchema).optional(),
});

export const careerOutlineDataSchema = z.object({
  courseSkillIds: z.array(z.string()).optional(),
  chapters: z.array(careerOutlineChapterSchema).optional(),
});

export type CareerOutlineData = z.infer<typeof careerOutlineDataSchema>;

export interface NormalizedCareerOutlineSection {
  sectionKey: string;
  title: string;
  description: string;
}

export interface NormalizedCareerOutlineChapter {
  chapterKey: string;
  chapterIndex: number;
  title: string;
  description: string;
  explicitSkillIds: string[];
  sections: NormalizedCareerOutlineSection[];
}

export interface NormalizedCareerOutline {
  courseSkillIds: string[];
  chapters: NormalizedCareerOutlineChapter[];
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

export function normalizeCareerOutline(outlineData: unknown): NormalizedCareerOutline {
  const parsed = careerOutlineDataSchema.parse(outlineData ?? {});

  return {
    courseSkillIds: uniqueStrings(parsed.courseSkillIds),
    chapters: (parsed.chapters ?? []).map((chapter, chapterIndex) => ({
      chapterKey: `chapter-${chapterIndex + 1}`,
      chapterIndex: chapterIndex + 1,
      title: chapter.title?.trim() || `第 ${chapterIndex + 1} 章`,
      description: chapter.description?.trim() || "",
      explicitSkillIds: uniqueStrings(chapter.skillIds),
      sections: (chapter.sections ?? []).map((section, sectionIndex) => ({
        sectionKey: `chapter-${chapterIndex + 1}-section-${sectionIndex + 1}`,
        title: section.title?.trim() || `第 ${chapterIndex + 1}.${sectionIndex + 1} 节`,
        description: section.description?.trim() || "",
      })),
    })),
  };
}

export function computeCareerOutlineHash(outline: NormalizedCareerOutline): string {
  return createHash("sha256").update(stableStringify(outline)).digest("hex");
}

import { createHash } from "node:crypto";
import { z } from "zod";
import {
  buildChapterOutlineNodeKey,
  buildSectionOutlineNodeKey,
} from "@/lib/learning/outline-node-key";
import { normalizeStringList, stableStringify } from "@/lib/utils/stable-data";

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

export function normalizeGrowthOutline(outlineInput: unknown): NormalizedGrowthOutline {
  const parsed = growthOutlineDataSchema.parse(outlineInput ?? {});

  return {
    courseSkillIds: normalizeStringList(parsed.courseSkillIds),
    chapters: (parsed.chapters ?? []).map((chapter, chapterIndex) => ({
      chapterKey: buildChapterOutlineNodeKey(chapterIndex),
      chapterIndex,
      title: chapter.title?.trim() || `第 ${chapterIndex + 1} 章`,
      description: chapter.description?.trim() || "",
      explicitSkillIds: normalizeStringList(chapter.skillIds),
      sections: (chapter.sections ?? []).map((section, sectionIndex) => ({
        sectionKey: buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
        title: section.title?.trim() || `第 ${chapterIndex + 1}.${sectionIndex + 1} 节`,
        description: section.description?.trim() || "",
      })),
    })),
  };
}

export function computeGrowthOutlineHash(outline: NormalizedGrowthOutline): string {
  return createHash("sha256").update(stableStringify(outline)).digest("hex");
}

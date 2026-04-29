import { createHash } from "node:crypto";
import type {
  CourseOutlineNode,
  CourseOutlineVersion,
  NewCourseOutlineNode,
  NewCourseOutlineVersion,
} from "@/db";
import type { CourseOutline } from "@/lib/learning/course-outline";
import {
  buildChapterOutlineNodeKey,
  buildSectionOutlineNodeKey,
} from "@/lib/learning/outline-node-key";
import { normalizeStringList, stableStringify } from "@/lib/utils/stable-data";

export function computeCourseOutlineVersionHash(outline: CourseOutline): string {
  return createHash("sha256").update(stableStringify(outline)).digest("hex");
}

export function buildCourseOutlineVersionValues(params: {
  courseId: string;
  outline: CourseOutline;
}): NewCourseOutlineVersion {
  const { courseId, outline } = params;
  return {
    courseId,
    versionHash: computeCourseOutlineVersionHash(outline),
    title: outline.title,
    description: outline.description ?? null,
    targetAudience: outline.targetAudience ?? null,
    difficulty: outline.difficulty,
    learningOutcome: outline.learningOutcome ?? null,
    courseSkillIds: normalizeStringList(outline.courseSkillIds),
    prerequisites: normalizeStringList(outline.prerequisites),
    isLatest: true,
    updatedAt: new Date(),
  };
}

export function buildCourseOutlineNodeValues(params: {
  courseId: string;
  outlineVersionId: string;
  outline: CourseOutline;
}): NewCourseOutlineNode[] {
  const { courseId, outlineVersionId, outline } = params;

  return outline.chapters.flatMap((chapter, chapterIndex) => {
    const chapterNodeKey = buildChapterOutlineNodeKey(chapterIndex);
    const chapterNode: NewCourseOutlineNode = {
      courseId,
      outlineVersionId,
      nodeType: "chapter",
      nodeKey: chapterNodeKey,
      parentNodeKey: null,
      chapterIndex,
      sectionIndex: null,
      position: chapterIndex,
      title: chapter.title,
      description: chapter.description ?? null,
      skillIds: normalizeStringList(chapter.skillIds),
      practiceType: chapter.practiceType ?? null,
      updatedAt: new Date(),
    };

    const sectionNodes = chapter.sections.map<NewCourseOutlineNode>((section, sectionIndex) => ({
      courseId,
      outlineVersionId,
      nodeType: "section",
      nodeKey: buildSectionOutlineNodeKey(chapterIndex, sectionIndex),
      parentNodeKey: chapterNodeKey,
      chapterIndex,
      sectionIndex,
      position: sectionIndex,
      title: section.title,
      description: section.description ?? null,
      skillIds: [],
      practiceType: null,
      updatedAt: new Date(),
    }));

    return [chapterNode, ...sectionNodes];
  });
}

export function materializeCourseOutline(params: {
  version: Pick<
    CourseOutlineVersion,
    | "title"
    | "description"
    | "targetAudience"
    | "difficulty"
    | "learningOutcome"
    | "courseSkillIds"
    | "prerequisites"
  >;
  nodes: Array<
    Pick<
      CourseOutlineNode,
      | "nodeType"
      | "nodeKey"
      | "parentNodeKey"
      | "chapterIndex"
      | "sectionIndex"
      | "position"
      | "title"
      | "description"
      | "skillIds"
      | "practiceType"
    >
  >;
}): CourseOutline {
  const { version, nodes } = params;
  const chapterNodes = nodes
    .filter((node) => node.nodeType === "chapter")
    .sort(
      (left, right) => left.chapterIndex - right.chapterIndex || left.position - right.position,
    );

  return {
    title: version.title,
    description: version.description ?? undefined,
    targetAudience: version.targetAudience ?? undefined,
    prerequisites: normalizeStringList(version.prerequisites ?? []),
    difficulty: version.difficulty as CourseOutline["difficulty"],
    courseSkillIds: normalizeStringList(version.courseSkillIds ?? []),
    learningOutcome: version.learningOutcome ?? undefined,
    chapters: chapterNodes.map((chapterNode) => ({
      title: chapterNode.title,
      description: chapterNode.description ?? undefined,
      practiceType: (chapterNode.practiceType ?? undefined) as
        | CourseOutline["chapters"][number]["practiceType"]
        | undefined,
      skillIds: normalizeStringList(chapterNode.skillIds ?? []),
      sections: nodes
        .filter((node) => node.nodeType === "section" && node.parentNodeKey === chapterNode.nodeKey)
        .sort(
          (left, right) => left.chapterIndex - right.chapterIndex || left.position - right.position,
        )
        .map((sectionNode) => ({
          title: sectionNode.title,
          description: sectionNode.description ?? undefined,
        })),
    })),
  };
}

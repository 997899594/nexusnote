import { createHash } from "node:crypto";
import type {
  CourseOutlineNode,
  CourseOutlineVersion,
  NewCourseOutlineNode,
  NewCourseOutlineVersion,
} from "@/db";
import type { CourseOutline } from "@/lib/learning/course-outline";

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

function normalizeStringArray(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

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
    description: outline.description,
    targetAudience: outline.targetAudience,
    difficulty: outline.difficulty,
    learningOutcome: outline.learningOutcome,
    courseSkillIds: normalizeStringArray(outline.courseSkillIds),
    prerequisites: normalizeStringArray(outline.prerequisites),
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
    const chapterNodeKey = `chapter-${chapterIndex + 1}`;
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
      description: chapter.description,
      skillIds: normalizeStringArray(chapter.skillIds),
      practiceType: chapter.practiceType ?? null,
      updatedAt: new Date(),
    };

    const sectionNodes = chapter.sections.map<NewCourseOutlineNode>((section, sectionIndex) => ({
      courseId,
      outlineVersionId,
      nodeType: "section",
      nodeKey: `section-${chapterIndex + 1}-${sectionIndex + 1}`,
      parentNodeKey: chapterNodeKey,
      chapterIndex,
      sectionIndex,
      position: sectionIndex,
      title: section.title,
      description: section.description,
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
    description: version.description ?? "",
    targetAudience: version.targetAudience ?? "",
    prerequisites: normalizeStringArray(version.prerequisites ?? []),
    difficulty: version.difficulty as CourseOutline["difficulty"],
    courseSkillIds: normalizeStringArray(version.courseSkillIds ?? []),
    learningOutcome: version.learningOutcome ?? "",
    chapters: chapterNodes.map((chapterNode) => ({
      title: chapterNode.title,
      description: chapterNode.description ?? "",
      practiceType: (chapterNode.practiceType ?? undefined) as
        | CourseOutline["chapters"][number]["practiceType"]
        | undefined,
      skillIds: normalizeStringArray(chapterNode.skillIds ?? []),
      sections: nodes
        .filter((node) => node.nodeType === "section" && node.parentNodeKey === chapterNode.nodeKey)
        .sort(
          (left, right) => left.chapterIndex - right.chapterIndex || left.position - right.position,
        )
        .map((sectionNode) => ({
          title: sectionNode.title,
          description: sectionNode.description ?? "",
        })),
    })),
  };
}

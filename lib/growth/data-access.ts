import { and, eq } from "drizzle-orm";
import { db, knowledgeEvidence } from "@/db";
import { buildSourceVersionCondition } from "@/lib/growth/source-version";
import type { CourseOutline } from "@/lib/learning/course-outline";
import { getOwnedCourseWithOutline } from "@/lib/learning/course-repository";

export interface CourseRow {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  outline: CourseOutline;
}

export interface EvidenceMergeRow {
  id: string;
  title: string;
  summary: string;
  confidence: string;
  sourceVersionHash: string | null;
}

export async function getCourseForGrowth(
  userId: string,
  courseId: string,
): Promise<CourseRow | null> {
  const course = await getOwnedCourseWithOutline(courseId, userId);
  if (!course) {
    return null;
  }

  return {
    id: course.id,
    userId: course.userId,
    title: course.title,
    description: course.description,
    outline: course.outline,
  };
}

export async function loadSourceEvidenceRows(params: {
  userId: string;
  sourceType: string;
  sourceId: string;
  sourceVersionHash?: string | null;
  kind?: string;
}): Promise<EvidenceMergeRow[]> {
  return db
    .select({
      id: knowledgeEvidence.id,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
      confidence: knowledgeEvidence.confidence,
      sourceVersionHash: knowledgeEvidence.sourceVersionHash,
    })
    .from(knowledgeEvidence)
    .where(
      and(
        eq(knowledgeEvidence.userId, params.userId),
        eq(knowledgeEvidence.sourceType, params.sourceType),
        eq(knowledgeEvidence.sourceId, params.sourceId),
        params.kind ? eq(knowledgeEvidence.kind, params.kind) : undefined,
        buildSourceVersionCondition(knowledgeEvidence.sourceVersionHash, params.sourceVersionHash),
      ),
    );
}

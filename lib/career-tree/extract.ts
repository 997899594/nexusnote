import { generateText, Output } from "ai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { careerCourseChapterEvidence, careerCourseSkillEvidence, db } from "@/db";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getModelNameForPolicy, getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import {
  CAREER_TREE_EXTRACT_PROMPT_VERSION,
  CAREER_TREE_EXTRACT_TIMEOUT_MS,
  MAX_CAREER_EVIDENCE_ITEMS_PER_COURSE,
} from "@/lib/career-tree/constants";
import { enqueueCareerTreeMerge } from "@/lib/career-tree/queue";
import {
  computeCareerOutlineHash,
  getCareerCourseSource,
  type NormalizedCareerOutline,
} from "@/lib/career-tree/source";
import { getOrCreateCareerRun, markCareerRunFailed, markCareerRunSucceeded } from "./runs";

export const careerEvidenceKindSchema = z.enum(["skill", "theme", "tool", "workflow", "concept"]);

export const extractedCareerEvidenceItemSchema = z.object({
  title: z.string().trim().min(1),
  kind: careerEvidenceKindSchema,
  summary: z.string().trim().min(1),
  confidence: z.number().min(0).max(1),
  chapterRefs: z.array(z.string().trim().min(1)).default([]),
  prerequisiteHints: z.array(z.string()).default([]),
  relatedHints: z.array(z.string()).default([]),
  evidenceSnippets: z.array(z.string()).default([]),
});

export const careerCourseExtractorOutputSchema = z.object({
  items: z.array(extractedCareerEvidenceItemSchema).max(MAX_CAREER_EVIDENCE_ITEMS_PER_COURSE),
});

export type ExtractedCareerEvidenceItem = z.infer<typeof extractedCareerEvidenceItemSchema>;
export type CareerCourseExtractorOutput = z.infer<typeof careerCourseExtractorOutputSchema>;

function buildCourseContext(params: {
  title: string;
  description: string | null;
  outline: NormalizedCareerOutline;
}): string {
  return JSON.stringify(
    {
      courseTitle: params.title,
      courseDescription: params.description,
      explicitCourseSkillIds: params.outline.courseSkillIds,
      prerequisites: params.outline.prerequisites,
      chapters: params.outline.chapters.map((chapter) => ({
        chapterKey: chapter.chapterKey,
        chapterIndex: chapter.chapterIndex + 1,
        title: chapter.title,
        description: chapter.description,
        explicitSkillIds: chapter.explicitSkillIds,
        sections: chapter.sections.map((section) => ({
          sectionKey: section.sectionKey,
          title: section.title,
          description: section.description,
        })),
      })),
    },
    null,
    2,
  );
}

export function buildCareerExtractionIdempotencyKey(
  userId: string,
  courseId: string,
  outlineHash: string,
): string {
  return `extract:user:${userId}:course:${courseId}:outline:${outlineHash}:prompt:${CAREER_TREE_EXTRACT_PROMPT_VERSION}`;
}

function validateExtractedEvidence(params: {
  extracted: CareerCourseExtractorOutput;
  outline: NormalizedCareerOutline;
}) {
  if (params.extracted.items.length === 0) {
    throw new Error("Career course extraction returned no evidence items");
  }

  const validChapterKeys = new Set(params.outline.chapters.map((chapter) => chapter.chapterKey));
  const invalidRefs = params.extracted.items.flatMap((item) =>
    item.chapterRefs
      .filter((chapterKey) => !validChapterKeys.has(chapterKey))
      .map((chapterKey) => `${item.title}:${chapterKey}`),
  );

  if (invalidRefs.length > 0) {
    throw new Error(`Career extraction returned invalid chapter refs: ${invalidRefs.join(", ")}`);
  }
}

async function runCareerCourseExtractor(params: {
  userId: string;
  courseId: string;
  title: string;
  description: string | null;
  outline: NormalizedCareerOutline;
}): Promise<CareerCourseExtractorOutput> {
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "career-tree:extract",
    intent: "career-tree-extract",
    workflow: "career-tree",
    modelPolicy: "extract-fast",
    promptVersion: CAREER_TREE_EXTRACT_PROMPT_VERSION,
    userId: params.userId,
    metadata: {
      courseId: params.courseId,
      chapterCount: params.outline.chapters.length,
    },
  });

  try {
    const result = await generateText({
      model: getPlainModelForPolicy("extract-fast"),
      output: Output.object({ schema: careerCourseExtractorOutputSchema }),
      prompt: renderPromptResource("career-tree/extract.md", {
        course_context: buildCourseContext(params),
      }),
      ...buildGenerationSettingsForPolicy("extract-fast", {
        temperature: 0.1,
        maxOutputTokens: 3_000,
      }),
      timeout: CAREER_TREE_EXTRACT_TIMEOUT_MS,
    });

    await recordAIUsage({
      ...telemetry,
      usage: result.usage,
      durationMs: Date.now() - startedAt,
      success: true,
    });

    return result.output;
  } catch (error) {
    await recordAIUsage({
      ...telemetry,
      durationMs: Date.now() - startedAt,
      success: false,
      errorMessage: getErrorMessage(error),
    });
    throw error;
  }
}

async function replaceExtractedCareerEvidence(params: {
  userId: string;
  courseId: string;
  extractRunId: string;
  outlineHash: string;
  outline: NormalizedCareerOutline;
  extracted: CareerCourseExtractorOutput;
}): Promise<void> {
  const evidenceRows = params.extracted.items.map((item) => ({
    id: crypto.randomUUID(),
    item,
  }));

  await db.transaction(async (tx) => {
    await tx
      .delete(careerCourseSkillEvidence)
      .where(eq(careerCourseSkillEvidence.extractRunId, params.extractRunId));
    await tx
      .delete(careerCourseChapterEvidence)
      .where(
        and(
          eq(careerCourseChapterEvidence.userId, params.userId),
          eq(careerCourseChapterEvidence.courseId, params.courseId),
        ),
      );

    if (evidenceRows.length === 0) {
      return;
    }

    await tx.insert(careerCourseSkillEvidence).values(
      evidenceRows.map(({ id, item }) => ({
        id,
        userId: params.userId,
        courseId: params.courseId,
        extractRunId: params.extractRunId,
        title: item.title,
        kind: item.kind,
        summary: item.summary,
        confidence: item.confidence.toFixed(3),
        chapterRefs: item.chapterRefs,
        prerequisiteHints: item.prerequisiteHints,
        relatedHints: item.relatedHints,
        evidenceSnippets: item.evidenceSnippets,
        sourceOutlineHash: params.outlineHash,
      })),
    );

    const evidenceIdsByChapterKey = new Map<string, string[]>();
    const confidenceByChapterKey = new Map<string, number[]>();

    for (const { id, item } of evidenceRows) {
      for (const chapterKey of item.chapterRefs) {
        const evidenceIds = evidenceIdsByChapterKey.get(chapterKey) ?? [];
        evidenceIds.push(id);
        evidenceIdsByChapterKey.set(chapterKey, evidenceIds);

        const confidences = confidenceByChapterKey.get(chapterKey) ?? [];
        confidences.push(item.confidence);
        confidenceByChapterKey.set(chapterKey, confidences);
      }
    }

    await tx.insert(careerCourseChapterEvidence).values(
      params.outline.chapters.map((chapter) => {
        const confidences = confidenceByChapterKey.get(chapter.chapterKey) ?? [];
        const confidence =
          confidences.length > 0
            ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
            : 0.5;

        return {
          userId: params.userId,
          courseId: params.courseId,
          chapterKey: chapter.chapterKey,
          chapterIndex: chapter.chapterIndex + 1,
          chapterTitle: chapter.title,
          skillEvidenceIds: evidenceIdsByChapterKey.get(chapter.chapterKey) ?? [],
          confidence: confidence.toFixed(3),
        };
      }),
    );
  });
}

export async function processCareerTreeExtractJob(job: {
  userId: string;
  courseId: string;
  enqueueFollowups?: boolean;
}): Promise<void> {
  const course = await getCareerCourseSource(job.userId, job.courseId);
  if (!course) {
    return;
  }

  const outlineHash = computeCareerOutlineHash(course.outline);
  const run = await getOrCreateCareerRun({
    userId: job.userId,
    courseId: job.courseId,
    kind: "extract",
    idempotencyKey: buildCareerExtractionIdempotencyKey(job.userId, job.courseId, outlineHash),
    inputHash: outlineHash,
    model: getModelNameForPolicy("extract-fast"),
    promptVersion: CAREER_TREE_EXTRACT_PROMPT_VERSION,
    reuseCompleted: true,
  });

  if (run.status === "succeeded") {
    if (job.enqueueFollowups !== false) {
      await enqueueCareerTreeMerge(job.userId, job.courseId, run.id);
    }
    return;
  }

  try {
    const extracted = await runCareerCourseExtractor({
      userId: job.userId,
      courseId: job.courseId,
      title: course.title,
      description: course.description,
      outline: course.outline,
    });

    validateExtractedEvidence({
      extracted,
      outline: course.outline,
    });

    await replaceExtractedCareerEvidence({
      userId: job.userId,
      courseId: job.courseId,
      extractRunId: run.id,
      outlineHash,
      outline: course.outline,
      extracted,
    });

    await markCareerRunSucceeded(db, run.id, extracted);

    if (job.enqueueFollowups !== false) {
      await enqueueCareerTreeMerge(job.userId, job.courseId, run.id);
    }
  } catch (error) {
    await markCareerRunFailed(run.id, error);
    throw error;
  }
}

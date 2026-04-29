import {
  EMPTY_USER_GROWTH_CONTEXT,
  getUserGrowthContextWithinBudget,
} from "@/lib/growth/generation-context";
import { createLearnTrace } from "@/lib/learning/observability";
import { enqueueCourseSectionMaterialization } from "@/lib/queue/course-production-queue";
import {
  prepareCourseSectionLiveStream,
  readCourseSectionLiveStream,
  resolveCourseSectionProductionInput,
} from "./course-section-production";

const LIVE_STREAM_POLL_INTERVAL_MS = 180;
const LIVE_STREAM_TIMEOUT_MS = 285_000;

interface GenerateCourseSectionWorkflowOptions {
  userId: string;
  courseId: string;
  chapterIndex: number;
  sectionIndex: number;
  traceId?: string;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createCourseSectionLiveResponse(params: {
  courseId: string;
  outlineNodeId: string;
  trace: ReturnType<typeof createLearnTrace>;
}) {
  const encoder = new TextEncoder();
  const startedAt = Date.now();
  let cancelled = false;

  const readableStream = new ReadableStream({
    async start(controller) {
      let offset = 0;

      try {
        while (!cancelled) {
          const snapshot = await readCourseSectionLiveStream({
            courseId: params.courseId,
            outlineNodeId: params.outlineNodeId,
            offset,
          });

          for (const chunk of snapshot.chunks) {
            controller.enqueue(encoder.encode(chunk));
          }
          offset = snapshot.nextOffset;

          if (snapshot.status === "complete") {
            params.trace.finish({
              mode: "live-materialization",
              outlineNodeId: params.outlineNodeId,
              sectionDocumentId: snapshot.sectionDocumentId,
              streamedChunks: offset,
            });
            controller.close();
            return;
          }

          if (snapshot.status === "error") {
            throw new Error(snapshot.error ?? "章节内容生成失败");
          }

          if (Date.now() - startedAt > LIVE_STREAM_TIMEOUT_MS) {
            throw new Error("章节内容生成超时");
          }

          await delay(LIVE_STREAM_POLL_INTERVAL_MS);
        }
      } catch (error) {
        params.trace.fail(error, {
          stage: "live-stream",
          outlineNodeId: params.outlineNodeId,
        });
        controller.error(error);
      }
    },
    cancel() {
      cancelled = true;
      params.trace.step("viewer-detached", {
        outlineNodeId: params.outlineNodeId,
      });
    },
  });

  return new Response(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      "X-Course-Id": params.courseId,
      "X-Section-Id": params.outlineNodeId,
    },
  });
}

export async function runGenerateCourseSectionWorkflow({
  userId,
  courseId,
  chapterIndex,
  sectionIndex,
  traceId,
}: GenerateCourseSectionWorkflowOptions): Promise<Response> {
  const trace = createLearnTrace(
    "generate-section-workflow",
    {
      userId,
      courseId,
      chapterIndex,
      sectionIndex,
    },
    traceId,
  );

  const generationContext =
    (await getUserGrowthContextWithinBudget(userId, {
      timeoutMs: 250,
      onTimeout: () => {
        trace.step("growth-context-budget-missed");
      },
    })) ?? EMPTY_USER_GROWTH_CONTEXT;
  const input = await resolveCourseSectionProductionInput({
    userId,
    courseId,
    chapterIndex,
    sectionIndex,
    growthContext: generationContext,
  });

  trace.step("section-resolved", {
    outlineNodeId: input.outlineNodeId,
    sectionTitle: input.section.title,
    existedBefore: Boolean(input.existingSection?.id),
  });

  if (input.existingSection?.content) {
    trace.finish({
      cacheHit: true,
      outlineNodeId: input.outlineNodeId,
      sectionDocumentId: input.existingSection.id,
      contentLength: input.existingSection.content.length,
    });
    return Response.json({
      exists: true,
      content: input.existingSection.content,
      documentId: input.existingSection.id,
    });
  }

  await prepareCourseSectionLiveStream({
    courseId,
    outlineNodeId: input.outlineNodeId,
  });
  const queued = await enqueueCourseSectionMaterialization({
    userId,
    courseId,
    chapterIndex,
    sectionIndex,
    reasonKey: `view:${input.outlineNodeId}`,
    priority: 1,
  });
  trace.step("materialization-queued", {
    outlineNodeId: input.outlineNodeId,
    jobId: queued.id,
  });

  return createCourseSectionLiveResponse({
    courseId,
    outlineNodeId: input.outlineNodeId,
    trace,
  });
}

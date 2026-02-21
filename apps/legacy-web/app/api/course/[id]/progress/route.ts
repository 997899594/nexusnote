import { auth } from "@/auth";
import { courseGenerationQueue } from "@/lib/queue/course-generation";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id: courseId } = await params;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // stream may be closed
        }
      };

      const job = await courseGenerationQueue.getJob(courseId);
      if (!job) {
        send({ status: "not_found" });
        controller.close();
        return;
      }

      const poll = setInterval(async () => {
        try {
          const progress = job.progress as Record<string, unknown>;
          const state = await job.getState();

          send({ progress, state });

          if (state === "completed" || state === "failed") {
            clearInterval(poll);
            send({
              status: state,
              result: state === "completed" ? job.returnvalue : null,
            });
            controller.close();
          }
        } catch {
          clearInterval(poll);
          controller.close();
        }
      }, 2000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

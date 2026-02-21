import { auth } from "@/auth";
import {
  confirmOutline,
  getInterviewSession,
} from "@/features/learning/services/interview-session";
import { courseGenerationQueue } from "@/lib/queue/course-generation";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sessionId, outlineData } = (await request.json()) as {
    sessionId: string;
    outlineData: Record<string, unknown>;
  };

  if (!sessionId || !outlineData) {
    return new Response("sessionId and outlineData required", { status: 400 });
  }

  const userId = session.user.id;

  // 验证 session 归属
  await getInterviewSession(sessionId, userId);

  // 确认大纲（写入 courseProfiles）
  await confirmOutline(sessionId, outlineData);

  // 入队 BullMQ 课程生成任务
  await courseGenerationQueue.add(
    "generate",
    { courseId: sessionId, userId },
    { jobId: sessionId },
  );

  return Response.json({ courseId: sessionId });
}

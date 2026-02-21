import { auth } from "@/auth";
import { getInterviewSession } from "@/features/learning/services/interview-session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  try {
    const interviewSession = await getInterviewSession(id, session.user.id);
    return Response.json({
      id: interviewSession.id,
      status: interviewSession.interviewStatus,
      profile: interviewSession.interviewProfile,
      messages: interviewSession.interviewMessages,
      title: interviewSession.title,
      outlineData: interviewSession.outlineData,
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

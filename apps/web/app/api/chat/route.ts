import { createAgentUIStreamResponse, smoothStream } from "ai";
import { auth } from "@/auth";
import { chatAgent } from "@/features/chat/agents/chat-agent";
import type { CourseGenerationContext } from "@/features/learning/agents/course-generation/agent";
import { courseGenerationAgent } from "@/features/learning/agents/course-generation/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { messages, explicitIntent, courseGenerationContext } = body as {
    messages: unknown[];
    explicitIntent?: "INTERVIEW" | "CHAT" | "EDITOR" | "SEARCH" | "COURSE_GENERATION";
    courseGenerationContext?: Record<string, unknown>;
  };

  const userId = session.user.id;
  const intent = explicitIntent ?? "INTERVIEW";

  switch (intent) {
    case "INTERVIEW": {
      const sessionId = body.sessionId as string | undefined;
      const initialGoal = body.initialGoal as string | undefined;

      if (!sessionId && !initialGoal) {
        return new Response("sessionId or initialGoal required", { status: 400 });
      }

      const { createInterviewAgent } = await import(
        "@/features/learning/agent/interview-agent"
      );
      const { createInterviewSession, getInterviewSession } = await import(
        "@/features/learning/services/interview-session"
      );

      let sid = sessionId;
      if (!sid) {
        sid = await createInterviewSession(userId, initialGoal!);
      } else {
        await getInterviewSession(sid, userId);
      }

      const agent = createInterviewAgent(sid);

      const response = await createAgentUIStreamResponse({
        agent,
        uiMessages: messages,
        options: { userId, sessionId: sid },
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });

      response.headers.set("X-Session-Id", sid);
      return response;
    }

    case "COURSE_GENERATION": {
      const options: CourseGenerationContext = {
        id: (courseGenerationContext?.id as string) ?? crypto.randomUUID(),
        userId,
        interviewProfile: courseGenerationContext?.interviewProfile as Record<string, unknown>,
        outlineTitle: (courseGenerationContext?.outlineTitle as string) ?? "",
        outlineData: courseGenerationContext?.outlineData as CourseGenerationContext["outlineData"],
        moduleCount: (courseGenerationContext?.moduleCount as number) ?? 0,
        totalChapters: (courseGenerationContext?.totalChapters as number) ?? 0,
        currentModuleIndex: (courseGenerationContext?.currentModuleIndex as number) ?? 0,
        currentChapterIndex: (courseGenerationContext?.currentChapterIndex as number) ?? 0,
        chaptersGenerated: (courseGenerationContext?.chaptersGenerated as number) ?? 0,
      };
      return createAgentUIStreamResponse({
        agent: courseGenerationAgent,
        uiMessages: messages,
        options,
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });
    }

    case "SEARCH": {
      return createAgentUIStreamResponse({
        agent: chatAgent,
        uiMessages: messages,
        options: { enableWebSearch: true, enableTools: true },
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });
    }

    case "EDITOR": {
      return createAgentUIStreamResponse({
        agent: chatAgent,
        uiMessages: messages,
        options: {
          editMode: true,
          enableTools: true,
        },
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });
    }
    default: {
      return createAgentUIStreamResponse({
        agent: chatAgent,
        uiMessages: messages,
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });
    }
  }
}

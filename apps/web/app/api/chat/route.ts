import { createAgentUIStreamResponse, smoothStream } from "ai";
import { auth } from "@/auth";
import { chatAgent } from "@/lib/ai/agents/chat-agent";
import type { CourseGenerationContext } from "@/lib/ai/agents/course-generation/agent";
import { courseGenerationAgent } from "@/lib/ai/agents/course-generation/agent";
import type { InterviewContext } from "@/lib/ai/agents/interview/agent";
import { interviewAgent } from "@/lib/ai/agents/interview/agent";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json();
  const { messages, explicitIntent, interviewContext, courseGenerationContext } = body as {
    messages: unknown[];
    explicitIntent?: "INTERVIEW" | "CHAT" | "EDITOR" | "SEARCH" | "COURSE_GENERATION";
    interviewContext?: InterviewContext;
    courseGenerationContext?: Record<string, unknown>;
  };

  const userId = session.user.id;
  const intent = explicitIntent ?? "INTERVIEW";

  // 根据意图选择对应的 agent
  switch (intent) {
    case "INTERVIEW": {
      const options: InterviewContext & { userId: string } = {
        goal: interviewContext?.goal ?? "",
        background: interviewContext?.background ?? "",
        targetOutcome: interviewContext?.targetOutcome ?? "",
        cognitiveStyle: interviewContext?.cognitiveStyle ?? "",
        userId,
      };
      return createAgentUIStreamResponse({
        agent: interviewAgent,
        uiMessages: messages,
        options,
        experimental_transform: smoothStream({
          chunking: new Intl.Segmenter("zh-CN", { granularity: "grapheme" }),
        }),
      });
    }

    case "COURSE_GENERATION": {
      const options: CourseGenerationContext = {
        id: (courseGenerationContext?.id as string) ?? crypto.randomUUID(),
        userId,
        goal: (courseGenerationContext?.goal as string) ?? "",
        background: (courseGenerationContext?.background as string) ?? "",
        targetOutcome: (courseGenerationContext?.targetOutcome as string) ?? "",
        cognitiveStyle: (courseGenerationContext?.cognitiveStyle as string) ?? "",
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

import { APIError } from "@/lib/api";
import { resolveOwnedLearnContext } from "@/lib/learning/resolve-learn-context";
import type { ChatMetadata, ResolvedChatMetadata } from "@/types/metadata";

export interface ResolvedChatContext {
  profileId: "CHAT_BASIC" | "LEARN_ASSIST";
  courseId?: string;
  metadata?: ResolvedChatMetadata;
}

export async function resolveChatContext({
  userId,
  courseId,
  metadata,
}: {
  userId: string;
  courseId?: string | null;
  metadata?: ChatMetadata;
}): Promise<ResolvedChatContext> {
  const requestedLearnContext =
    metadata?.context === "learn"
      ? {
          courseId: metadata.courseId,
          chapterIndex: metadata.chapterIndex,
        }
      : courseId
        ? {
            courseId,
            chapterIndex: 0,
          }
        : null;

  if (!requestedLearnContext) {
    return {
      profileId: "CHAT_BASIC",
      courseId: undefined,
      metadata:
        metadata?.context === "editor" || metadata?.context === "default" ? metadata : undefined,
    };
  }

  const learnContext = await resolveOwnedLearnContext({
    userId,
    courseId: requestedLearnContext.courseId,
    chapterIndex: requestedLearnContext.chapterIndex,
  });

  if (!learnContext) {
    throw new APIError("课程不存在或无权限访问", 404, "COURSE_NOT_FOUND");
  }

  return {
    profileId: "LEARN_ASSIST",
    courseId: learnContext.courseId,
    metadata: {
      context: "learn",
      courseId: learnContext.courseId,
      courseTitle: learnContext.courseTitle,
      chapterIndex: learnContext.chapterIndex,
      chapterTitle: learnContext.chapterTitle,
    },
  };
}

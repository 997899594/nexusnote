import { APIError } from "@/lib/api";
import type { LearningGuidance } from "@/lib/learning/guidance";
import { getLearningGuidance } from "@/lib/learning/guidance";
import type { ChatMetadata } from "@/types/metadata";

export interface ResolvedChatContext {
  profileId: "CHAT_BASIC" | "LEARN_ASSIST";
  courseId?: string;
  metadata?: ChatMetadata;
  learningGuidance?: LearningGuidance;
}

function buildRequestedLearnContext(params: {
  courseId?: string | null;
  metadata?: ChatMetadata;
}): { courseId: string; chapterIndex: number } | null {
  if (params.metadata?.context === "learn") {
    return {
      courseId: params.metadata.courseId,
      chapterIndex: params.metadata.chapterIndex,
    };
  }

  if (!params.courseId) {
    return null;
  }

  return {
    courseId: params.courseId,
    chapterIndex: 0,
  };
}

function getBasicChatMetadata(metadata?: ChatMetadata): ChatMetadata | undefined {
  if (metadata?.context === "editor" || metadata?.context === "default") {
    return metadata;
  }

  return undefined;
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
  const requestedLearnContext = buildRequestedLearnContext({
    courseId,
    metadata,
  });

  if (!requestedLearnContext) {
    return {
      profileId: "CHAT_BASIC",
      courseId: undefined,
      metadata: getBasicChatMetadata(metadata),
    };
  }

  const learningGuidance = await getLearningGuidance({
    userId,
    courseId: requestedLearnContext.courseId,
    chapterIndex: requestedLearnContext.chapterIndex,
  });

  if (!learningGuidance) {
    throw new APIError("课程不存在或无权限访问", 404, "COURSE_NOT_FOUND");
  }

  return {
    profileId: "LEARN_ASSIST",
    courseId: learningGuidance.course.id,
    metadata: {
      context: "learn",
      courseId: learningGuidance.course.id,
      chapterIndex: learningGuidance.chapter.index,
    },
    learningGuidance,
  };
}

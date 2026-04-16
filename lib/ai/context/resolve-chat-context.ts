import { APIError } from "@/lib/api";
import { resolveOwnedLearnContext } from "@/lib/learning/resolve-learn-context";
import type { ChatMetadata, ResolvedChatMetadata } from "@/types/metadata";

export interface ResolvedChatContext {
  profileId: "CHAT_BASIC" | "LEARN_ASSIST";
  courseId?: string;
  metadata?: ResolvedChatMetadata;
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

function getBasicChatMetadata(metadata?: ChatMetadata): ResolvedChatMetadata | undefined {
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
      chapterDescription: learnContext.chapterDescription,
      sectionTitles: learnContext.sectionTitles,
      courseSkillIds: learnContext.courseSkillIds,
      chapterSkillIds: learnContext.chapterSkillIds,
    },
  };
}

import type { UIMessage } from "ai";
import type { AIRouteProfile } from "@/lib/ai/core/route-profiles";
import { extractUIMessageText } from "@/lib/ai/message-text";
import { APIError } from "@/lib/api";
import { getLatestCareerTreeSnapshotRow } from "@/lib/career-tree/snapshot";
import { getOwnedConversation } from "@/lib/chat/conversation-repository";
import { isUuidString } from "@/lib/chat/session-id";
import { getLearningGuidance, type LearningGuidance } from "@/lib/learning/guidance";
import {
  isCareerRequestMetadata,
  isEditorRequestMetadata,
  isInterviewRequestMetadata,
  isLearnRequestMetadata,
  type RequestMetadata,
  RequestMetadataSchema,
} from "@/types/request-metadata";
import type { RequestContext, Surface } from "./contracts";

const MAX_RECENT_MESSAGES = 6;

export interface ResolvedRequestContext extends RequestContext {
  learningGuidance?: LearningGuidance;
}

function buildRecentMessages(messages: UIMessage[]): string[] {
  return messages
    .map((message) => extractUIMessageText(message))
    .filter((text) => text.length > 0)
    .slice(-MAX_RECENT_MESSAGES);
}

function resolveSurface(input: { courseId?: string | null; metadata?: RequestMetadata }): Surface {
  if (isLearnRequestMetadata(input.metadata) || input.courseId) {
    return "learn";
  }

  if (isEditorRequestMetadata(input.metadata)) {
    return "notes";
  }

  if (isCareerRequestMetadata(input.metadata)) {
    return "career";
  }

  if (isInterviewRequestMetadata(input.metadata)) {
    return "interview";
  }

  return "chat";
}

function buildRequestedLearnContext(params: {
  courseId?: string | null;
  metadata?: RequestMetadata;
}): { courseId: string; chapterIndex: number; sectionIndex?: number } | null {
  if (isLearnRequestMetadata(params.metadata)) {
    return {
      courseId: params.metadata.courseId,
      chapterIndex: params.metadata.chapterIndex,
      sectionIndex: params.metadata.sectionIndex,
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

async function resolveSessionRequestMetadata(params: {
  userId: string;
  sessionId?: string | null;
}): Promise<RequestMetadata | undefined> {
  if (!params.sessionId || !isUuidString(params.sessionId)) {
    return undefined;
  }

  const conversation = await getOwnedConversation(params.sessionId, params.userId);

  if (!conversation) {
    return undefined;
  }

  if (conversation.intent === "LEARN" && conversation.learnCourseId) {
    const parsedConversationMetadata = RequestMetadataSchema.safeParse(conversation.metadata);
    const persistedLearnMetadata =
      parsedConversationMetadata.success && isLearnRequestMetadata(parsedConversationMetadata.data)
        ? parsedConversationMetadata.data
        : null;

    return {
      context: "learn",
      courseId: conversation.learnCourseId,
      chapterIndex: conversation.learnChapterIndex ?? 0,
      sectionIndex: persistedLearnMetadata?.sectionIndex,
      chapterSkillIds: persistedLearnMetadata?.chapterSkillIds,
    };
  }

  const parsedMetadata = RequestMetadataSchema.safeParse(conversation.metadata);
  return parsedMetadata.success ? parsedMetadata.data : undefined;
}

export async function resolveRequestContext(params: {
  userId: string;
  messages: UIMessage[];
  sessionId?: string | null;
  courseId?: string | null;
  metadata?: RequestMetadata;
  routeProfile: AIRouteProfile;
  skinSlug?: string | null;
}): Promise<ResolvedRequestContext> {
  const sessionMetadata = params.metadata
    ? undefined
    : await resolveSessionRequestMetadata({
        userId: params.userId,
        sessionId: params.sessionId,
      });
  const effectiveMetadata = params.metadata ?? sessionMetadata;
  const surface = resolveSurface({
    courseId: params.courseId,
    metadata: effectiveMetadata,
  });
  const requestedLearnContext = buildRequestedLearnContext({
    courseId: params.courseId,
    metadata: effectiveMetadata,
  });

  const [learningGuidance, latestCareerTreeSnapshot] = await Promise.all([
    requestedLearnContext
      ? getLearningGuidance({
          userId: params.userId,
          courseId: requestedLearnContext.courseId,
          chapterIndex: requestedLearnContext.chapterIndex,
        })
      : Promise.resolve(null),
    getLatestCareerTreeSnapshotRow(params.userId),
  ]);

  if (requestedLearnContext && !learningGuidance) {
    throw new APIError("课程不存在或无权限访问", 404, "COURSE_NOT_FOUND");
  }

  const resolvedMetadata = learningGuidance
    ? ({
        context: "learn",
        courseId: learningGuidance.course.id,
        chapterIndex: learningGuidance.chapter.index,
        sectionIndex: requestedLearnContext?.sectionIndex,
      } satisfies RequestMetadata)
    : effectiveMetadata;

  return {
    surface,
    sessionId: params.sessionId ?? null,
    recentMessages: buildRecentMessages(params.messages),
    metadata: resolvedMetadata,
    resourceContext: learningGuidance
      ? {
          courseId: learningGuidance.course.id,
          chapterIndex: learningGuidance.chapter.index,
          sectionIndex: requestedLearnContext?.sectionIndex,
        }
      : isEditorRequestMetadata(effectiveMetadata)
        ? {
            documentId: effectiveMetadata.documentId,
          }
        : {},
    hasLearningGuidance: Boolean(learningGuidance),
    hasCareerTreeSnapshot: Boolean(latestCareerTreeSnapshot),
    hasEditorContext: isEditorRequestMetadata(effectiveMetadata),
    userPolicy: {
      routeProfile: params.routeProfile,
      skinSlug: params.skinSlug ?? null,
    },
    learningGuidance: learningGuidance ?? undefined,
  };
}

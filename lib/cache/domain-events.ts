import {
  revalidateCareerTrees,
  revalidateCoursePublication,
  revalidateLearnPage,
  revalidateNoteDetail,
  revalidateNotesIndex,
  revalidateProfileStats,
  revalidateRecentCourses,
} from "@/lib/cache/tags";

export function revalidateConversationViews(userId: string): void {
  revalidateProfileStats(userId);
}

export function revalidateCourseCreationViews(userId: string, courseId: string): void {
  revalidateRecentCourses(userId);
  revalidateProfileStats(userId);
  revalidateLearnPage(userId, courseId);
}

export function revalidateCourseContentViews(userId: string, courseId: string): void {
  revalidateLearnPage(userId, courseId);
}

export function revalidateCoursePublicationViews(slugOrId: string): void {
  revalidateCoursePublication(slugOrId);
}

export function revalidateCourseProgressViews(userId: string, courseId: string): void {
  revalidateRecentCourses(userId);
  revalidateLearnPage(userId, courseId);
  revalidateCareerTrees(userId);
}

export function revalidateCareerTreeViews(userId: string): void {
  revalidateCareerTrees(userId);
}

export function revalidateKnowledgeWorkspaceViews(userId: string): void {
  revalidateCareerTrees(userId);
  revalidateProfileStats(userId);
  revalidateNotesIndex(userId);
}

export function revalidateNoteWorkspaceViews(userId: string, noteId: string): void {
  revalidateNotesIndex(userId);
  revalidateNoteDetail(userId, noteId);
  revalidateProfileStats(userId);
}

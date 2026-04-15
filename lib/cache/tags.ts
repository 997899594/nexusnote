import { revalidateTag } from "next/cache";

function canIgnoreRevalidateError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes("static generation store missing");
}

function revalidateTagSafely(tag: string): void {
  try {
    revalidateTag(tag, "max");
  } catch (error) {
    if (canIgnoreRevalidateError(error)) {
      return;
    }
    throw error;
  }
}

export function getRecentCoursesTag(userId: string): string {
  return `recent-courses:${userId}`;
}

export function getProfileStatsTag(userId: string): string {
  return `profile-stats:${userId}`;
}

export function getLearnPageTag(userId: string, courseId: string): string {
  return `learn-page:${userId}:${courseId}`;
}

export function getCareerTreesTag(userId: string): string {
  return `career-trees:${userId}`;
}

export function getNotesIndexTag(userId: string): string {
  return `notes-index:${userId}`;
}

export function getNoteDetailTag(userId: string, noteId: string): string {
  return `note-detail:${userId}:${noteId}`;
}

export function revalidateRecentCourses(userId: string): void {
  revalidateTagSafely(getRecentCoursesTag(userId));
}

export function revalidateProfileStats(userId: string): void {
  revalidateTagSafely(getProfileStatsTag(userId));
}

export function revalidateLearnPage(userId: string, courseId: string): void {
  revalidateTagSafely(getLearnPageTag(userId, courseId));
}

export function revalidateCareerTrees(userId: string): void {
  revalidateTagSafely(getCareerTreesTag(userId));
}

export function revalidateNotesIndex(userId: string): void {
  revalidateTagSafely(getNotesIndexTag(userId));
}

export function revalidateNoteDetail(userId: string, noteId: string): void {
  revalidateTagSafely(getNoteDetailTag(userId, noteId));
}

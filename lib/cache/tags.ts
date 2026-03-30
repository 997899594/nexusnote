import { revalidateTag } from "next/cache";

export function getRecentCoursesTag(userId: string): string {
  return `recent-courses:${userId}`;
}

export function getProfileStatsTag(userId: string): string {
  return `profile-stats:${userId}`;
}

export function getLearnPageTag(userId: string, courseId: string): string {
  return `learn-page:${userId}:${courseId}`;
}

export function getGoldenPathTag(userId: string): string {
  return `golden-path:${userId}`;
}

export function getNotesIndexTag(userId: string): string {
  return `notes-index:${userId}`;
}

export function getNoteDetailTag(userId: string, noteId: string): string {
  return `note-detail:${userId}:${noteId}`;
}

export function revalidateRecentCourses(userId: string): void {
  revalidateTag(getRecentCoursesTag(userId), "max");
}

export function revalidateProfileStats(userId: string): void {
  revalidateTag(getProfileStatsTag(userId), "max");
}

export function revalidateLearnPage(userId: string, courseId: string): void {
  revalidateTag(getLearnPageTag(userId, courseId), "max");
}

export function revalidateGoldenPath(userId: string): void {
  revalidateTag(getGoldenPathTag(userId), "max");
}

export function revalidateNotesIndex(userId: string): void {
  revalidateTag(getNotesIndexTag(userId), "max");
}

export function revalidateNoteDetail(userId: string, noteId: string): void {
  revalidateTag(getNoteDetailTag(userId, noteId), "max");
}

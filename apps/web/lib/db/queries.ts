/**
 * Shared Database Queries
 *
 * 抽取共享的数据库查询逻辑，避免代码重复
 */

import { db } from "@nexusnote/db";
import {
  courseProfiles,
  courseChapters,
  documents,
  documentSnapshots,
  extractedNotes,
  topics,
  workspaces,
  eq,
  and,
  desc,
  count,
  inArray,
} from "@nexusnote/db";
import { RecordNotFoundError } from "@/lib/errors";

// ============================================
// Course Queries
// ============================================

/**
 * 获取用户的课程画像（带所有权验证）
 */
export async function getUserCourse(
  userId: string,
  courseId: string,
) {
  const profile = await db.query.courseProfiles.findFirst({
    where: and(
      eq(courseProfiles.id, courseId),
      eq(courseProfiles.userId, userId),
    ),
  });

  if (!profile) {
    throw new RecordNotFoundError("Course", courseId);
  }

  return profile;
}

/**
 * 获取用户的所有课程列表
 */
export async function getUserCourses(userId: string) {
  return db.query.courseProfiles.findMany({
    where: eq(courseProfiles.userId, userId),
    orderBy: [desc(courseProfiles.createdAt)],
  });
}

/**
 * 获取课程的所有章节
 */
export async function getCourseChapters(courseId: string) {
  return db.query.courseChapters.findMany({
    where: eq(courseChapters.profileId, courseId),
    orderBy: [courseChapters.chapterIndex, courseChapters.sectionIndex],
  });
}

/**
 * 获取特定章节内容
 */
export async function getChapter(
  profileId: string,
  chapterIndex: number,
  sectionIndex = 1,
) {
  const chapter = await db.query.courseChapters.findFirst({
    where: and(
      eq(courseChapters.profileId, profileId),
      eq(courseChapters.chapterIndex, chapterIndex),
      eq(courseChapters.sectionIndex, sectionIndex),
    ),
  });

  if (!chapter) {
    throw new RecordNotFoundError("Chapter", `${profileId}-${chapterIndex}-${sectionIndex}`);
  }

  return chapter;
}

// ============================================
// Document Queries
// ============================================

/**
 * 获取用户的文档（带所有权验证）
 * 注意：文档通过 workspace 关联用户，需要联表查询
 */
export async function getUserDocument(
  userId: string,
  documentId: string,
) {
  const document = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
    with: {
      workspace: true,
    },
  });

  if (!document) {
    throw new RecordNotFoundError("Document", documentId);
  }

  // 验证所有权：workspace 的 ownerId 必须匹配 userId
  if (document.workspace?.ownerId !== userId) {
    throw new RecordNotFoundError("Document", documentId);
  }

  return document;
}

/**
 * 获取用户的所有文档列表
 * 注意：通过 workspace.ownerId 过滤
 */
export async function getUserDocuments(
  userId: string,
  limit = 50,
  offset = 0,
) {
  // 先获取用户的所有 workspace
  const userWorkspaces = await db.query.workspaces.findMany({
    where: eq(workspaces.ownerId, userId),
    columns: {
      id: true,
    },
  });

  const workspaceIds = userWorkspaces.map((w) => w.id);

  if (workspaceIds.length === 0) {
    return [];
  }

  return db.query.documents.findMany({
    where: inArray(documents.workspaceId, workspaceIds),
    orderBy: [desc(documents.updatedAt)],
    limit,
    offset,
  });
}

/**
 * 获取文档的最新快照时间戳
 */
export async function getLatestSnapshotTimestamp(documentId: string) {
  const latest = await db.query.documentSnapshots.findFirst({
    where: eq(documentSnapshots.documentId, documentId),
    orderBy: [desc(documentSnapshots.timestamp)],
  });

  return latest ? latest.timestamp.getTime() : null;
}

// ============================================
// Note / Topic Queries
// ============================================

/**
 * 获取用户的所有主题
 */
export async function getUserTopics(userId: string) {
  return db.query.topics.findMany({
    where: eq(topics.userId, userId),
    orderBy: [desc(topics.lastActiveAt)],
  });
}

/**
 * 获取主题及其最近的笔记
 */
export async function getTopicWithNotes(
  userId: string,
  topicId: string,
  noteLimit = 5,
) {
  const topic = await db.query.topics.findFirst({
    where: and(
      eq(topics.id, topicId),
      eq(topics.userId, userId),
    ),
    with: {
      notes: {
        limit: noteLimit,
        orderBy: [desc(extractedNotes.createdAt)],
      },
    },
  });

  if (!topic) {
    throw new RecordNotFoundError("Topic", topicId);
  }

  return topic;
}

/**
 * 获取笔记数量统计
 */
export async function getNotesCount(userId: string) {
  const [result] = await db
    .select({ count: count() })
    .from(extractedNotes)
    .where(eq(extractedNotes.userId, userId));

  return result?.count || 0;
}

// ============================================
// Batch Operations
// ============================================

/**
 * 批量获取多个文档（带所有权验证）
 * 注意：文档通过 workspace 关联用户
 */
export async function getDocumentsByIds(
  userId: string,
  documentIds: string[],
) {
  if (documentIds.length === 0) return [];

  // 先获取用户的所有 workspace
  const userWorkspaces = await db.query.workspaces.findMany({
    where: eq(workspaces.ownerId, userId),
    columns: {
      id: true,
    },
  });

  const workspaceIds = userWorkspaces.map((w) => w.id);

  if (workspaceIds.length === 0) {
    return [];
  }

  return db.query.documents.findMany({
    where: and(
      inArray(documents.workspaceId, workspaceIds),
      inArray(documents.id, documentIds),
    ),
  });
}

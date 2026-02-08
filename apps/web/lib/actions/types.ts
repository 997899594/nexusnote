/**
 * 2026 架构师标准：标准返回协议 (ActionResult)
 *
 * 职责：
 * 1. 消除 any，强制类型约束
 * 2. 区分 业务成功 与 系统错误
 */
export type ActionSuccess<T> = {
  success: true;
  data: T;
  error?: never;
};

export type ActionError = {
  success: false;
  data?: never;
  error: string;
  code?: string;
};

export type ActionResult<T> = ActionSuccess<T> | ActionError;

/**
 * 2026 架构师标准：统一领域 DTO 定义
 */
export interface NoteDTO {
  id: string;
  content: string;
  createdAt: string;
  title: string;
}

export interface DocumentDTO {
  id: string;
  title: string;
  content: string | null;
  updatedAt: string | null;
  createdAt: string;
  isVault: boolean;
  description?: string;
  author?: string;
}

export interface TopicDTO {
  id: string;
  name: string;
  noteCount: number;
  lastActiveAt: string | null;
  notes?: NoteDTO[];
}

export interface CourseChapterDTO {
  id: string;
  chapterIndex: number;
  sectionIndex: number;
  title: string;
  contentMarkdown: string;
  summary: string | null;
  keyPoints: string[] | null;
  isCompleted: boolean;
  createdAt: string;
}

export interface CourseProfileDTO {
  id: string;
  title: string;
  progress: {
    currentChapter: number;
    currentSection: number;
  };
  userId: string;
  goal: string;
  background: string;
  targetOutcome: string;
  cognitiveStyle: string;
  outlineData: any; // 或者具体的 OutlineData 类型
}

export interface RecentItemDTO {
  id: string;
  title: string;
  type: "course" | "note";
  updatedAt: string; // ISO String
}

/**
 * 助手工具：确保 Action 返回结果符合协议
 */
export function success<T>(data: T): ActionSuccess<T> {
  return { success: true, data };
}

export function error(message: string, code?: string): ActionError {
  return { success: false, error: message, code };
}

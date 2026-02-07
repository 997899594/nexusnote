/**
 * Learning Store - AI 驱动的学习内容管理
 *
 * 核心流程：
 * 1. 用户输入学习目标
 * 2. AI 生成结构化课程大纲
 * 3. 每个章节自动创建为 document（复用现有编辑器）
 * 4. 学习进度跟踪
 */

import { v4 as uuid } from 'uuid'
import {
  localDb,
  STORES,
  LocalLearningContent,
  LocalLearningChapter,
  LocalLearningProgress,
  LocalLearningHighlight,
  LearningContentType,
  LearningDifficulty,
} from './local-db'
import { documentStore } from './document-store'

export interface CourseOutline {
  title: string
  description: string
  difficulty: LearningDifficulty
  estimatedMinutes: number
  chapters: {
    title: string
    summary: string
    keyPoints: string[]
  }[]
}

export class LearningStore {
  // ============================================
  // Learning Content CRUD
  // ============================================

  /**
   * 创建学习内容（从 AI 生成的大纲）
   */
  async createFromOutline(
    outline: CourseOutline,
    type: LearningContentType = 'course',
    id?: string
  ): Promise<LocalLearningContent> {
    const contentId = id || uuid()
    const now = Date.now()

    // 创建学习内容记录
    const content: LocalLearningContent = {
      id: contentId,
      title: outline.title,
      type,
      totalChapters: outline.chapters.length,
      difficulty: outline.difficulty,
      estimatedMinutes: outline.estimatedMinutes,
      tags: [],
      summary: outline.description,
      createdAt: now,
      updatedAt: now,
      syncedAt: null,
      isDirty: true,
    }

    await localDb.put(STORES.LEARNING_CONTENTS, content)

    // 为每个章节创建 document 和 chapter 记录
    for (let i = 0; i < outline.chapters.length; i++) {
      const chapter = outline.chapters[i]
      const documentId = uuid()
      const chapterId = uuid()

      // 创建文档（复用现有 document 系统）
      await documentStore.createDocument(documentId, chapter.title)

      // 创建章节记录
      const chapterRecord: LocalLearningChapter = {
        id: chapterId,
        contentId,
        documentId,
        chapterIndex: i,
        title: chapter.title,
        summary: chapter.summary,
        keyPoints: chapter.keyPoints,
        createdAt: now,
      }

      await localDb.put(STORES.LEARNING_CHAPTERS, chapterRecord)
    }

    // 创建进度记录
    await this.initProgress(contentId)

    console.log('[LearningStore] Created course:', content.title, 'with', outline.chapters.length, 'chapters')
    return content
  }

  /**
   * 获取所有学习内容
   */
  async getAllContents(): Promise<LocalLearningContent[]> {
    return localDb.getAll<LocalLearningContent>(STORES.LEARNING_CONTENTS)
  }

  /**
   * 获取单个学习内容
   */
  async getContent(id: string): Promise<LocalLearningContent | undefined> {
    return localDb.get<LocalLearningContent>(STORES.LEARNING_CONTENTS, id)
  }

  /**
   * 删除学习内容（级联删除章节、进度、高亮）
   */
  async deleteContent(id: string): Promise<void> {
    // 获取所有章节
    const chapters = await this.getChapters(id)

    // 删除章节关联的文档和高亮
    for (const chapter of chapters) {
      await documentStore.purgeDocument(chapter.documentId)
      const highlights = await this.getHighlightsByChapter(chapter.id)
      for (const h of highlights) {
        await localDb.delete(STORES.LEARNING_HIGHLIGHTS, h.id)
      }
      await localDb.delete(STORES.LEARNING_CHAPTERS, chapter.id)
    }

    // 删除进度
    const progress = await this.getProgress(id)
    if (progress) {
      await localDb.delete(STORES.LEARNING_PROGRESS, progress.id)
    }

    // 删除内容
    await localDb.delete(STORES.LEARNING_CONTENTS, id)

    console.log('[LearningStore] Deleted content:', id)
  }

  // ============================================
  // Chapters
  // ============================================

  /**
   * 获取学习内容的所有章节
   */
  async getChapters(contentId: string): Promise<LocalLearningChapter[]> {
    const chapters = await localDb.getAllByIndex<LocalLearningChapter>(
      STORES.LEARNING_CHAPTERS,
      'contentId',
      contentId
    )
    return chapters.sort((a, b) => a.chapterIndex - b.chapterIndex)
  }

  /**
   * 获取单个章节
   */
  async getChapter(id: string): Promise<LocalLearningChapter | undefined> {
    return localDb.get<LocalLearningChapter>(STORES.LEARNING_CHAPTERS, id)
  }

  /**
   * 通过 documentId 获取章节
   */
  async getChapterByDocument(documentId: string): Promise<LocalLearningChapter | undefined> {
    const chapters = await localDb.getAllByIndex<LocalLearningChapter>(
      STORES.LEARNING_CHAPTERS,
      'documentId',
      documentId
    )
    return chapters[0]
  }

  // ============================================
  // Progress Tracking
  // ============================================

  /**
   * 初始化学习进度
   */
  async initProgress(contentId: string): Promise<LocalLearningProgress> {
    const now = Date.now()
    const progress: LocalLearningProgress = {
      id: uuid(),
      contentId,
      currentChapter: 0,
      completedChapters: [],
      totalTimeSpent: 0,
      lastAccessedAt: now,
      startedAt: now,
      masteryLevel: 0,
    }

    await localDb.put(STORES.LEARNING_PROGRESS, progress)
    return progress
  }

  /**
   * 获取学习进度
   */
  async getProgress(contentId: string): Promise<LocalLearningProgress | undefined> {
    const progresses = await localDb.getAllByIndex<LocalLearningProgress>(
      STORES.LEARNING_PROGRESS,
      'contentId',
      contentId
    )
    return progresses[0]
  }

  /**
   * 更新当前章节
   */
  async updateCurrentChapter(contentId: string, chapterIndex: number): Promise<void> {
    const progress = await this.getProgress(contentId)
    if (!progress) return

    progress.currentChapter = chapterIndex
    progress.lastAccessedAt = Date.now()

    await localDb.put(STORES.LEARNING_PROGRESS, progress)
  }

  /**
   * 标记章节完成
   */
  async markChapterCompleted(contentId: string, chapterIndex: number): Promise<void> {
    const progress = await this.getProgress(contentId)
    if (!progress) return

    if (!progress.completedChapters.includes(chapterIndex)) {
      progress.completedChapters.push(chapterIndex)
      progress.completedChapters.sort((a, b) => a - b)
    }

    // 检查是否全部完成
    const content = await this.getContent(contentId)
    if (content && progress.completedChapters.length >= content.totalChapters) {
      progress.completedAt = Date.now()
      progress.masteryLevel = 100
    } else {
      // 计算掌握度
      progress.masteryLevel = content
        ? Math.round((progress.completedChapters.length / content.totalChapters) * 100)
        : 0
    }

    progress.lastAccessedAt = Date.now()
    await localDb.put(STORES.LEARNING_PROGRESS, progress)
  }

  /**
   * 添加学习时间
   */
  async addTimeSpent(contentId: string, minutes: number): Promise<void> {
    const progress = await this.getProgress(contentId)
    if (!progress) return

    progress.totalTimeSpent += minutes
    progress.lastAccessedAt = Date.now()

    await localDb.put(STORES.LEARNING_PROGRESS, progress)
  }

  // ============================================
  // Highlights & Notes
  // ============================================

  /**
   * 创建高亮
   */
  async createHighlight(
    chapterId: string,
    content: string,
    position: number,
    color: LocalLearningHighlight['color'] = 'yellow',
    note?: string
  ): Promise<LocalLearningHighlight> {
    const highlight: LocalLearningHighlight = {
      id: uuid(),
      chapterId,
      content,
      note,
      color,
      position,
      createdAt: Date.now(),
    }

    await localDb.put(STORES.LEARNING_HIGHLIGHTS, highlight)
    return highlight
  }

  /**
   * 获取章节的所有高亮
   */
  async getHighlightsByChapter(chapterId: string): Promise<LocalLearningHighlight[]> {
    return localDb.getAllByIndex<LocalLearningHighlight>(
      STORES.LEARNING_HIGHLIGHTS,
      'chapterId',
      chapterId
    )
  }

  /**
   * 更新高亮笔记
   */
  async updateHighlightNote(id: string, note: string): Promise<void> {
    const highlight = await localDb.get<LocalLearningHighlight>(STORES.LEARNING_HIGHLIGHTS, id)
    if (!highlight) return

    highlight.note = note
    await localDb.put(STORES.LEARNING_HIGHLIGHTS, highlight)
  }

  /**
   * 删除高亮
   */
  async deleteHighlight(id: string): Promise<void> {
    await localDb.delete(STORES.LEARNING_HIGHLIGHTS, id)
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * 获取学习统计
   */
  async getStats(): Promise<{
    totalCourses: number
    completedCourses: number
    totalTimeSpent: number
    averageMastery: number
  }> {
    const contents = await this.getAllContents()
    const progresses: LocalLearningProgress[] = []

    for (const content of contents) {
      const progress = await this.getProgress(content.id)
      if (progress) progresses.push(progress)
    }

    const completedCourses = progresses.filter(p => p.completedAt).length
    const totalTimeSpent = progresses.reduce((sum, p) => sum + p.totalTimeSpent, 0)
    const averageMastery = progresses.length > 0
      ? Math.round(progresses.reduce((sum, p) => sum + p.masteryLevel, 0) / progresses.length)
      : 0

    return {
      totalCourses: contents.length,
      completedCourses,
      totalTimeSpent,
      averageMastery,
    }
  }
}

// Singleton instance
export const learningStore = new LearningStore()

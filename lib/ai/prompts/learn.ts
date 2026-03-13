/**
 * 章节内容生成 Prompt
 *
 * 根据课程大纲和章节信息，生成完整的教学内容。
 */
export function buildChapterPrompt(params: {
  courseTitle: string;
  courseDescription: string;
  targetAudience: string;
  difficulty: string;
  chapterIndex: number;
  chapterTitle: string;
  chapterDescription: string;
  topics: string[];
  totalChapters: number;
  outlineSummary: string;
}): string {
  const {
    courseTitle,
    courseDescription,
    targetAudience,
    difficulty,
    chapterIndex,
    chapterTitle,
    chapterDescription,
    topics,
    totalChapters,
    outlineSummary,
  } = params;

  const difficultyLabel =
    difficulty === "beginner" ? "入门" : difficulty === "intermediate" ? "中级" : "高级";

  return `你是一位专业的课程内容创作者，正在为在线学习平台编写教学内容。

## 课程信息
- 课程名称：${courseTitle}
- 课程简介：${courseDescription}
- 目标受众：${targetAudience}
- 难度级别：${difficultyLabel}
- 总章节数：${totalChapters}

## 当前章节
- 第 ${chapterIndex + 1} 章：${chapterTitle}
- 章节描述：${chapterDescription}
- 涵盖主题：${topics.join("、")}

## 课程大纲（全貌）
${outlineSummary}

## 内容生成要求

1. **篇幅**：2000-4000 字的完整教学内容
2. **结构**：使用清晰的 Markdown 格式
   - 以二级标题 (##) 开始每个主要知识点
   - 合理使用三级标题 (###) 组织子内容
   - 使用列表、粗体、引用等增强可读性
3. **教学法**：
   - 概念讲解要通俗易懂，配合生动的类比或示例
   - 每个核心知识点后附带实际应用场景
   - 章节末尾提供关键要点总结
4. **语言**：中文，语气专业但亲切
5. **连贯性**：注意与前后章节的衔接，避免内容重复

直接输出教学内容，不要输出任何前缀说明。`;
}

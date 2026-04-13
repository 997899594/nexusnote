/**
 * 小节内容生成 Prompt
 *
 * 根据课程大纲和小节信息，生成聚焦单个知识点的教学内容。
 */
export function buildSectionPrompt(params: {
  courseTitle: string;
  courseDescription: string;
  targetAudience: string;
  difficulty: string;
  learningOutcome?: string;
  courseSkillIds?: string[];
  chapterIndex: number;
  chapterTitle: string;
  chapterDescription: string;
  chapterSkillIds?: string[];
  sectionIndex: number;
  sectionTitle: string;
  sectionDescription: string;
  siblingTitles: string[]; // other section titles in the same chapter
  totalChapters: number;
}): string {
  const {
    courseTitle,
    courseDescription,
    targetAudience,
    difficulty,
    learningOutcome,
    courseSkillIds,
    chapterIndex,
    chapterTitle,
    chapterDescription,
    chapterSkillIds,
    sectionIndex,
    sectionTitle,
    sectionDescription,
    siblingTitles,
    totalChapters,
  } = params;

  const difficultyLabel =
    difficulty === "beginner" ? "入门" : difficulty === "intermediate" ? "中级" : "高级";

  const siblingContext = siblingTitles
    .map((t, i) => `  ${i === sectionIndex ? "→" : " "} ${chapterIndex + 1}.${i + 1} ${t}`)
    .join("\n");

  const formatSkillIds = (skillIds?: string[]) =>
    Array.isArray(skillIds) && skillIds.length > 0 ? skillIds.join("、") : "未指定";

  return `你是一位专业的课程内容创作者，正在为在线学习平台编写教学内容。

## 课程信息
- 课程名称：${courseTitle}
- 课程简介：${courseDescription}
- 目标受众：${targetAudience}
- 难度级别：${difficultyLabel}
- 总章节数：${totalChapters}
- 课程学习成果：${learningOutcome ?? "未提供"}
- 课程核心能力：${formatSkillIds(courseSkillIds)}

## 当前位置
- 第 ${chapterIndex + 1} 章：${chapterTitle}
- 章节描述：${chapterDescription}
- 本章训练能力：${formatSkillIds(chapterSkillIds)}
- 本章小节：
${siblingContext}

## 当前小节
- ${chapterIndex + 1}.${sectionIndex + 1} ${sectionTitle}
- 描述：${sectionDescription}

## 内容生成要求

1. **篇幅**：500-1500 字，聚焦单个知识点
2. **结构**：使用清晰的 Markdown 格式
   - 以二级标题 (##) 开始本节内容
   - 合理使用三级标题 (###) 组织子内容
   - 使用列表、粗体、代码块、引用等增强可读性
3. **教学法**：
   - 概念讲解要通俗易懂，配合生动的类比或示例
   - 关键概念附带实际应用场景
   - 结尾简要总结要点（1-3条）
4. **语言**：中文，语气专业但亲切
5. **衔接**：注意与同章其他小节的关系，避免重复
6. **能力导向**：
   - 讲解时要服务于“本章训练能力”和“课程学习成果”
   - 如果是项目型章节，要多写决策思路、常见坑和交付标准
   - 不要只写概念定义，要让学习者知道这节内容如何推进对应能力

直接输出教学内容，不要输出任何前缀说明。`;
}

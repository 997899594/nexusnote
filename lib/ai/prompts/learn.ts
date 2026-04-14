/**
 * 小节内容生成 Prompt
 *
 * 根据课程大纲和小节信息，生成聚焦单个知识点的教学内容。
 */
interface SectionGenerationContext {
  currentDirection: {
    directionKey: string | null;
    title: string | null;
    summary: string | null;
    whyThisDirection: string | null;
  } | null;
  currentFocus: {
    nodeId: string | null;
    title: string | null;
    summary: string | null;
    state: string | null;
    progress: number | null;
  } | null;
  insights: Array<{
    kind: string;
    title: string;
    summary: string;
    confidence: number;
  }>;
}

function formatGenerationContext(context?: SectionGenerationContext): string {
  if (!context) {
    return "暂无成长上下文。";
  }

  const chunks: string[] = [];

  if (context.currentDirection?.title) {
    chunks.push(
      `- 当前主方向：${context.currentDirection.title}${
        context.currentDirection.summary ? `（${context.currentDirection.summary}）` : ""
      }`,
    );
  }

  if (context.currentFocus?.title) {
    chunks.push(
      `- 当前焦点：${context.currentFocus.title}${
        context.currentFocus.summary ? `（${context.currentFocus.summary}）` : ""
      }${
        context.currentFocus.state
          ? `，状态 ${context.currentFocus.state}，进度 ${context.currentFocus.progress ?? 0}%`
          : ""
      }`,
    );
  }

  if (context.insights.length > 0) {
    chunks.push(
      `- 最近成长信号：${context.insights
        .map(
          (insight) =>
            `${insight.title}（${insight.kind}，${Math.round(insight.confidence * 100)}%）`,
        )
        .join("；")}`,
    );
  }

  return chunks.length > 0 ? chunks.join("\n") : "暂无成长上下文。";
}

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
  generationContext?: SectionGenerationContext;
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
    generationContext,
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

## 当前成长上下文
${formatGenerationContext(generationContext)}

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
7. **成长对齐**：
   - 如果当前成长上下文里有“当前焦点”或“主方向”，解释时要明确这节内容与它们的关系
   - 优先强调这节内容如何帮助补当前短板、推进当前焦点，或巩固当前主方向
   - 不要凭空扩展到与当前成长方向无关的大话题

直接输出教学内容，不要输出任何前缀说明。`;
}

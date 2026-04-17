/**
 * 小节内容生成 Prompt
 *
 * 根据课程大纲和小节信息，生成聚焦单个知识点的教学内容。
 */
import { formatLearningAlignmentBrief } from "@/lib/learning/alignment";
import type { LearningGuidance } from "@/lib/learning/guidance";

export function buildSectionPrompt(params: {
  guidance: LearningGuidance;
  sectionIndex: number;
}): string {
  const { guidance, sectionIndex } = params;
  const section = guidance.chapter.sections[sectionIndex];

  if (!section) {
    throw new Error(`Missing learning guidance section at index ${sectionIndex}`);
  }

  const difficultyLabel =
    guidance.course.difficulty === "beginner"
      ? "入门"
      : guidance.course.difficulty === "intermediate"
        ? "中级"
        : "高级";

  const siblingContext = guidance.chapter.sections
    .map(
      (item, index) =>
        `  ${index === sectionIndex ? "→" : " "} ${guidance.chapter.index + 1}.${index + 1} ${item.title}`,
    )
    .join("\n");

  const formatSkillIds = (skillIds?: string[]) =>
    Array.isArray(skillIds) && skillIds.length > 0 ? skillIds.join("、") : "未指定";

  return `你是一位专业的课程内容创作者，正在为在线学习平台编写教学内容。

## 课程信息
- 课程名称：${guidance.course.title}
- 课程简介：${guidance.course.description}
- 目标受众：${guidance.course.targetAudience}
- 难度级别：${difficultyLabel}
- 总章节数：${guidance.course.totalChapters}
- 课程学习成果：${guidance.course.learningOutcome ?? "未提供"}
- 课程核心能力：${formatSkillIds(guidance.course.skillIds)}

## 当前位置
- 第 ${guidance.chapter.index + 1} 章：${guidance.chapter.title}
- 章节描述：${guidance.chapter.description}
- 本章训练能力：${formatSkillIds(guidance.chapter.skillIds)}
- 本章小节：
${siblingContext}

## 当前小节
- ${guidance.chapter.index + 1}.${sectionIndex + 1} ${section.title}
- 描述：${section.description}

## 当前学习对齐简报
${formatLearningAlignmentBrief(section.alignment, "prompt")}

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
   - 严格参考“当前学习对齐简报”来决定这节内容是直接推进、支撑前置，还是边界清晰的补充扩展
   - 如果对齐关系是“直接推进”，要明确这节内容学完后会如何推进当前焦点
   - 如果对齐关系是“支撑前置”，要重点讲清它是为哪个更高层能力打基础
   - 如果对齐关系偏弱，要把边界讲清楚，不要凭空扩展到与当前成长方向无关的大话题

直接输出教学内容，不要输出任何前缀说明。`;
}

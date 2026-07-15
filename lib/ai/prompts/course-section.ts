import { renderPromptResource } from "@/lib/ai/prompts/load-prompt";
import type { CourseSectionEvidenceContext } from "@/lib/ai/research/course-section-evidence";
import type { LearningGuidance } from "@/lib/learning/guidance";

export function buildCourseSectionUserPrompt(sectionTitle: string): string {
  return renderPromptResource("learn/course-section-user.md", {
    section_title: sectionTitle,
  });
}

function formatSkillIds(skillIds?: string[]): string {
  return Array.isArray(skillIds) && skillIds.length > 0 ? skillIds.join("、") : "未指定";
}

function formatResearchCitationContext(guidance: LearningGuidance): string {
  const citations = guidance.course.researchCitations.slice(0, 8);
  if (citations.length === 0) {
    return "无外部来源。";
  }

  return citations
    .map((citation, index) => {
      const details = [
        citation.domain,
        citation.sourceType,
        citation.qualityTier,
        citation.publishedAt ? `published=${citation.publishedAt}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const snippet = citation.snippet ? `\n  摘要：${citation.snippet}` : "";

      return `[S${index + 1}] ${citation.title}\n  URL：${citation.url}\n  来源：${details || "未标注"}${snippet}`;
    })
    .join("\n");
}

export function buildCourseSectionSystemPrompt(params: {
  guidance: LearningGuidance;
  sectionIndex: number;
  sectionEvidenceContext?: CourseSectionEvidenceContext | null;
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

  return renderPromptResource("learn/course-section-system.md", {
    course_title: guidance.course.title,
    course_description: guidance.course.description,
    target_audience: guidance.course.targetAudience,
    difficulty_label: difficultyLabel,
    total_chapters: guidance.course.totalChapters,
    learning_outcome: guidance.course.learningOutcome ?? "未提供",
    course_skill_ids: formatSkillIds(guidance.course.skillIds),
    research_citations: formatResearchCitationContext(guidance),
    section_research_evidence:
      params.sectionEvidenceContext?.promptBlock ??
      "本小节未触发额外实时检索；不要主动写未经核验的最新事实。",
    chapter_number: guidance.chapter.index + 1,
    chapter_title: guidance.chapter.title,
    chapter_description: guidance.chapter.description,
    chapter_skill_ids: formatSkillIds(guidance.chapter.skillIds),
    sibling_context: siblingContext,
    section_number: `${guidance.chapter.index + 1}.${sectionIndex + 1}`,
    section_title: section.title,
    section_description: section.description,
  });
}

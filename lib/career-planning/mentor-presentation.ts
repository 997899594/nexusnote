import type {
  CareerGraphPatch,
  CareerMentorBrief,
  CareerMentorDirection,
  CareerMentorSkillPriority,
} from "@/lib/ai/career-planning/schemas";

export interface CareerMentorDirectionView {
  title: string;
  counselorTake: string;
  decisionPressure: string;
  source: CareerMentorDirection["source"];
}

export interface CareerMentorSkillPriorityView {
  title: string;
  why: string;
  source: CareerMentorSkillPriority["source"];
}

export interface CareerMentorPresentation {
  observation: string | null;
  directions: CareerMentorDirectionView[];
  skillPriorities: CareerMentorSkillPriorityView[];
  marketContext: string | null;
  researchSources: CareerMentorBrief["researchSources"];
  question: string;
  options: string[];
}

const ROBOTIC_SENTENCE_PATTERNS = [
  /先说人话/u,
  /别急着/u,
  /封神/u,
  /你这棵树/u,
  /硬骨头/u,
  /下水道/u,
  /^匹配[：:]/u,
  /^价值[：:]/u,
  /^成长[：:]/u,
  /^取舍[：:]/u,
  /^第\s*\d+\s*个问题/u,
  /以下是/u,
  /综合来看/u,
];

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/gu, " ").replace(/[“”]/gu, '"').replace(/[‘’]/gu, "'").trim();
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[。！？!?；;])\s*/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function isRoboticSentence(sentence: string): boolean {
  return ROBOTIC_SENTENCE_PATTERNS.some((pattern) => pattern.test(sentence));
}

function cleanUserVisibleText(value: string | null | undefined): string {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  const sentences = splitSentences(normalized);
  if (sentences.length === 0) {
    return isRoboticSentence(normalized) ? "" : normalized;
  }

  const cleaned = sentences.filter((sentence) => !isRoboticSentence(sentence)).join("");
  return cleaned.trim();
}

function toDirectionView(direction: CareerMentorDirection): CareerMentorDirectionView | null {
  const title = cleanUserVisibleText(direction.title);
  const counselorTake = cleanUserVisibleText(direction.counselorTake);
  const decisionPressure = cleanUserVisibleText(direction.decisionPressure);

  if (!title || !counselorTake) {
    return null;
  }

  return {
    title,
    counselorTake,
    decisionPressure,
    source: direction.source,
  };
}

function toSkillPriorityView(
  skill: CareerMentorSkillPriority,
): CareerMentorSkillPriorityView | null {
  const title = cleanUserVisibleText(skill.title);
  const why = cleanUserVisibleText(skill.why);

  if (!title) {
    return null;
  }

  return {
    title,
    why,
    source: skill.source,
  };
}

export function buildCareerMentorPresentation(patch: CareerGraphPatch): CareerMentorPresentation {
  const brief = patch.mentorBrief;

  return {
    observation: cleanUserVisibleText(brief?.openingObservation) || null,
    directions: (brief?.recommendedDirections ?? [])
      .map(toDirectionView)
      .filter((direction): direction is CareerMentorDirectionView => Boolean(direction)),
    skillPriorities: (brief?.skillPriorities ?? [])
      .map(toSkillPriorityView)
      .filter((skill): skill is CareerMentorSkillPriorityView => Boolean(skill)),
    marketContext: cleanUserVisibleText(brief?.marketContext) || null,
    researchSources: brief?.researchSources ?? [],
    question: cleanUserVisibleText(patch.nextQuestion.question) || patch.nextQuestion.question,
    options: patch.nextQuestion.options ?? [],
  };
}

import { GOLDEN_PATH_SKILLS } from "./ontology";

interface OutlineSection {
  title: string;
  description?: string;
}

interface OutlineChapter {
  title: string;
  description: string;
  sections: OutlineSection[];
  practiceType?: "exercise" | "project" | "quiz" | "none";
  skillIds?: string[];
}

interface OutlineLike {
  title: string;
  description: string;
  targetAudience?: string;
  prerequisites?: string[];
  learningOutcome?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  courseSkillIds?: string[];
  chapters: OutlineChapter[];
}

interface MappingMetadata {
  matchedAliases: string[];
  matchedSignals?: string[];
  inferredFrom?: string[];
  sourceHits?: string[];
  matchScore: number;
}

export interface DerivedCourseSkillMapping {
  skillId: string;
  confidence: number;
  source: "outline_explicit" | "heuristic";
  metadata: MappingMetadata;
}

export interface DerivedCourseChapterSkillMapping {
  chapterIndex: number;
  skillId: string;
  confidence: number;
  source: "outline_explicit" | "heuristic";
  metadata: MappingMetadata & {
    chapterTitle: string;
  };
}

export interface DerivedCourseMappings {
  courseMappings: DerivedCourseSkillMapping[];
  chapterMappings: DerivedCourseChapterSkillMapping[];
}

interface WeightedSource {
  label: string;
  text: string;
  weight: number;
}

interface SkillSignalPack {
  primary: string[];
  secondary?: string[];
}

interface MatchAccumulator {
  matchedAliases: Set<string>;
  matchedSignals: Set<string>;
  inferredFrom: Set<string>;
  sourceHits: Set<string>;
  score: number;
}

const SKILL_SIGNAL_PACKS: Record<string, SkillSignalPack> = {
  "rapid-prototyping": {
    primary: ["作品集", "portfolio", "项目实战", "实战项目", "从想法到产品", "项目落地"],
    secondary: ["案例实战", "完整项目", "项目演练", "做作品", "做项目", "原型验证"],
  },
  "problem-framing": {
    primary: ["问题拆解", "需求澄清", "目标定义", "场景分析"],
    secondary: ["问题分析", "需求判断", "机会识别"],
  },
  "user-research": {
    primary: ["访谈提纲", "用户画像", "用户洞察", "定性研究"],
    secondary: ["访谈", "观察用户", "用户反馈"],
  },
  "product-strategy": {
    primary: ["价值主张", "产品定位", "策略设计", "成功标准"],
    secondary: ["路线规划", "产品方向", "商业场景"],
  },
  typescript: {
    primary: ["类型安全", "类型推导", "泛型", "interface", "类型约束"],
    secondary: ["tsconfig", "类型定义", "类型体操"],
  },
  react: {
    primary: ["组件化", "状态管理", "hooks", "jsx", "路由", "前端界面"],
    secondary: ["组件设计", "状态流转", "交互式界面"],
  },
  nextjs: {
    primary: ["app router", "server component", "route handler", "ssr", "ssg"],
    secondary: ["next image", "server action", "next auth"],
  },
  "api-design": {
    primary: ["接口契约", "接口设计", "请求响应", "服务端接口"],
    secondary: ["restful", "server action", "api route", "接口错误处理"],
  },
  "database-modeling": {
    primary: ["数据建模", "表结构", "schema 设计", "数据库设计"],
    secondary: ["drizzle", "postgres schema", "关系设计", "索引设计"],
  },
  "llm-architecture": {
    primary: ["上下文工程", "rag", "tool calling", "流式输出", "智能体工作流"],
    secondary: ["prompt 编排", "模型路由", "向量检索", "推理链路"],
  },
  "prompt-engineering": {
    primary: ["提示词设计", "系统提示词", "few shot", "结构化输出"],
    secondary: ["角色提示词", "提示模板", "prompt 调优"],
  },
  "ai-evaluation": {
    primary: ["评测集", "回归评测", "质量门槛", "自动评估"],
    secondary: ["judge model", "评分标准", "评测 runner"],
  },
  "automation-workflows": {
    primary: ["工作流编排", "自动化流程", "webhook", "agent tool", "任务编排"],
    secondary: ["n8n", "自动执行", "工具链路"],
  },
  "delivery-observability": {
    primary: ["部署上线", "日志监控", "可观测性", "告警治理"],
    secondary: ["docker", "ci cd", "回滚", "监控面板"],
  },
  sql: {
    primary: ["数据查询", "聚合分析", "多表关联", "窗口函数"],
    secondary: ["查询优化", "sql 实战", "分析查询"],
  },
  "python-analysis": {
    primary: ["pandas", "notebook", "数据清洗", "探索性分析"],
    secondary: ["python 数据分析", "matplotlib", "numpy"],
  },
  statistics: {
    primary: ["实验设计", "显著性", "ab test", "假设检验"],
    secondary: ["置信区间", "样本量", "统计推断"],
  },
  visualization: {
    primary: ["图表设计", "dashboard", "看板搭建", "数据表达"],
    secondary: ["tableau", "power bi", "可视化分析"],
  },
  "business-analysis": {
    primary: ["业务洞察", "漏斗分析", "留存分析", "转化分析"],
    secondary: ["增长分析", "指标体系", "经营分析"],
  },
  "launch-growth": {
    primary: ["冷启动", "用户获取", "增长实验", "分发策略"],
    secondary: ["内容增长", "渠道测试", "获客"],
  },
  monetization: {
    primary: ["定价策略", "付费设计", "订阅模式", "收入模型"],
    secondary: ["变现", "套餐设计", "商业闭环"],
  },
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: Iterable<string>): string[] {
  return [...new Set([...values].filter(Boolean))];
}

function findMatchedPhrases(haystack: string, phrases: string[]): string[] {
  const normalizedHaystack = normalizeText(haystack);
  if (!normalizedHaystack) {
    return [];
  }

  const matched = new Set<string>();

  for (const phrase of phrases) {
    const normalizedPhrase = normalizeText(phrase);
    if (!normalizedPhrase || normalizedPhrase.length < 2) {
      continue;
    }

    if (normalizedHaystack.includes(normalizedPhrase)) {
      matched.add(phrase);
    }
  }

  return [...matched];
}

function scorePhrases(phrases: string[]): number {
  return phrases.reduce((score, phrase) => score + (normalizeText(phrase).length >= 5 ? 2 : 1), 0);
}

function toConfidence(score: number): number {
  return Math.max(20, Math.min(100, Math.round(18 + score * 11)));
}

function createAccumulator(): MatchAccumulator {
  return {
    matchedAliases: new Set<string>(),
    matchedSignals: new Set<string>(),
    inferredFrom: new Set<string>(),
    sourceHits: new Set<string>(),
    score: 0,
  };
}

function addPhraseMatches(
  accumulator: MatchAccumulator,
  source: WeightedSource,
  phrases: string[],
  kind: "alias" | "signal",
  multiplier = 1,
) {
  const matched = findMatchedPhrases(source.text, phrases);
  if (matched.length === 0) {
    return;
  }

  const weightedScore = scorePhrases(matched) * source.weight * multiplier;
  accumulator.score += weightedScore;
  accumulator.sourceHits.add(source.label);

  for (const phrase of matched) {
    if (kind === "alias") {
      accumulator.matchedAliases.add(phrase);
      continue;
    }

    accumulator.matchedSignals.add(phrase);
  }
}

function addInferredMatch(
  accumulator: MatchAccumulator,
  inferredFrom: string,
  score: number,
  sourceLabel: string,
) {
  accumulator.score += score;
  accumulator.inferredFrom.add(inferredFrom);
  accumulator.sourceHits.add(sourceLabel);
}

function buildCourseSources(outline: OutlineLike): WeightedSource[] {
  return [
    { label: "course.title", text: outline.title, weight: 2.8 },
    { label: "course.description", text: outline.description, weight: 2.1 },
    { label: "course.targetAudience", text: outline.targetAudience ?? "", weight: 1.1 },
    { label: "course.learningOutcome", text: outline.learningOutcome ?? "", weight: 2.2 },
    {
      label: "course.prerequisites",
      text: outline.prerequisites?.join(" ") ?? "",
      weight: 1.3,
    },
    ...outline.chapters.flatMap((chapter, chapterIndex) => [
      {
        label: `chapter.${chapterIndex + 1}.title`,
        text: chapter.title,
        weight: 1.2,
      },
      {
        label: `chapter.${chapterIndex + 1}.description`,
        text: chapter.description,
        weight: 0.8,
      },
      ...chapter.sections.flatMap((section, sectionIndex) => [
        {
          label: `chapter.${chapterIndex + 1}.section.${sectionIndex + 1}.title`,
          text: section.title,
          weight: 0.4,
        },
        {
          label: `chapter.${chapterIndex + 1}.section.${sectionIndex + 1}.description`,
          text: section.description ?? "",
          weight: 0.35,
        },
      ]),
    ]),
  ];
}

function buildChapterSources(chapter: OutlineChapter, chapterIndex: number): WeightedSource[] {
  return [
    { label: `chapter.${chapterIndex}.title`, text: chapter.title, weight: 2.2 },
    { label: `chapter.${chapterIndex}.description`, text: chapter.description, weight: 1.4 },
    ...chapter.sections.flatMap((section, sectionIndex) => [
      {
        label: `chapter.${chapterIndex}.section.${sectionIndex + 1}.title`,
        text: section.title,
        weight: 0.8,
      },
      {
        label: `chapter.${chapterIndex}.section.${sectionIndex + 1}.description`,
        text: section.description ?? "",
        weight: 0.55,
      },
    ]),
  ];
}

function scoreSkillAgainstSources(
  sources: WeightedSource[],
  skill: (typeof GOLDEN_PATH_SKILLS)[number],
): MatchAccumulator {
  const accumulator = createAccumulator();
  const signalPack = SKILL_SIGNAL_PACKS[skill.id];
  const aliasKeys = new Set(
    [skill.name, ...skill.aliases].map((phrase) => normalizeText(phrase)).filter(Boolean),
  );
  const primarySignals =
    signalPack?.primary.filter((phrase) => !aliasKeys.has(normalizeText(phrase))) ?? [];
  const secondarySignals =
    signalPack?.secondary?.filter((phrase) => !aliasKeys.has(normalizeText(phrase))) ?? [];

  for (const source of sources) {
    addPhraseMatches(accumulator, source, [skill.name, ...skill.aliases], "alias");

    if (signalPack) {
      addPhraseMatches(accumulator, source, primarySignals, "signal", 0.85);
      addPhraseMatches(accumulator, source, secondarySignals, "signal", 0.55);
    }
  }

  return accumulator;
}

function isProjectCourse(outline: OutlineLike): boolean {
  const projectSignals = findMatchedPhrases(
    [outline.title, outline.description, outline.learningOutcome ?? ""].join(" "),
    ["项目", "实战", "作品集", "portfolio", "案例落地", "完整作品"],
  );

  return (
    projectSignals.length > 0 ||
    outline.chapters.some((chapter) => chapter.practiceType === "project")
  );
}

function buildMetadata(accumulator: MatchAccumulator): MappingMetadata {
  return {
    matchedAliases: uniqueStrings(accumulator.matchedAliases),
    matchedSignals: uniqueStrings(accumulator.matchedSignals),
    inferredFrom: uniqueStrings(accumulator.inferredFrom),
    sourceHits: uniqueStrings(accumulator.sourceHits),
    matchScore: Number(accumulator.score.toFixed(2)),
  };
}

function shouldKeepCourseSkill(accumulator: MatchAccumulator): boolean {
  return accumulator.score >= 2.6;
}

function shouldKeepChapterSkill(accumulator: MatchAccumulator): boolean {
  return accumulator.score >= 2;
}

function isGenericChapter(chapter: OutlineChapter, chapterIndex: number): boolean {
  const normalizedTitle = normalizeText(chapter.title);
  const normalizedDescription = normalizeText(chapter.description);
  const genericTitlePatterns = [
    new RegExp(`^第\\s*${chapterIndex}\\s*章$`),
    new RegExp(`^第\\s*${chapterIndex}\\s*章\\s+.+主题$`),
    /^chapter\s+\d+$/,
  ];
  const genericDescriptionPatterns = [
    /^围绕第\s*\d+\s*章建立关键理解与实践能力$/,
    /^学习.+核心概念.+方法.+应用方式$/,
  ];

  const titleLooksGeneric = genericTitlePatterns.some((pattern) => pattern.test(normalizedTitle));
  const descriptionLooksGeneric = genericDescriptionPatterns.some((pattern) =>
    pattern.test(normalizedDescription),
  );

  return titleLooksGeneric || descriptionLooksGeneric;
}

function isKnownSkillId(skillId: string): boolean {
  return GOLDEN_PATH_SKILLS.some((skill) => skill.id === skillId);
}

function normalizeSkillIds(skillIds: string[] | undefined): string[] {
  if (!Array.isArray(skillIds)) {
    return [];
  }

  return uniqueStrings(
    skillIds.filter((skillId) => typeof skillId === "string" && isKnownSkillId(skillId)),
  );
}

function createExplicitMetadata(sourceLabel: string, score = 100): MappingMetadata {
  return {
    matchedAliases: [],
    matchedSignals: [],
    inferredFrom: [],
    sourceHits: [sourceLabel],
    matchScore: score,
  };
}

export function deriveCourseSkillMappings(outline: OutlineLike): DerivedCourseMappings {
  const explicitChapterSkillIds = outline.chapters.map((chapter) =>
    normalizeSkillIds(chapter.skillIds),
  );
  const directExplicitCourseSkillIds = normalizeSkillIds(outline.courseSkillIds);
  const explicitCourseSkillIds = uniqueStrings([
    ...directExplicitCourseSkillIds,
    ...explicitChapterSkillIds.flat(),
  ]);
  const hasExplicitCourseSkills = explicitCourseSkillIds.length > 0;
  const hasExplicitChapterSkills = explicitChapterSkillIds.some((skillIds) => skillIds.length > 0);

  const courseSources = buildCourseSources(outline);
  const projectCourse = isProjectCourse(outline);
  const courseAccumulators = new Map<string, MatchAccumulator>();

  for (const skill of GOLDEN_PATH_SKILLS) {
    const accumulator = scoreSkillAgainstSources(courseSources, skill);
    courseAccumulators.set(skill.id, accumulator);
  }

  const strongAnchors = GOLDEN_PATH_SKILLS.filter((skill) => {
    const accumulator = courseAccumulators.get(skill.id);
    return accumulator ? accumulator.score >= 6.2 : false;
  });

  if (projectCourse) {
    const productLikeAnchors = strongAnchors.filter(
      (skill) =>
        skill.id !== "rapid-prototyping" &&
        skill.domainIds.some((domainId) =>
          ["product", "frontend", "backend", "ai-systems"].includes(domainId),
        ),
    );

    if (productLikeAnchors.length > 0) {
      const rapidPrototypeAccumulator =
        courseAccumulators.get("rapid-prototyping") ?? createAccumulator();
      const inferScore = 2.4 + Math.min(1.8, productLikeAnchors.length * 0.6);

      for (const anchor of productLikeAnchors) {
        addInferredMatch(
          rapidPrototypeAccumulator,
          anchor.id,
          inferScore / productLikeAnchors.length,
          "course.project_inference",
        );
      }

      courseAccumulators.set("rapid-prototyping", rapidPrototypeAccumulator);
    }
  }

  for (const anchor of strongAnchors) {
    const anchorAccumulator = courseAccumulators.get(anchor.id);
    if (!anchorAccumulator || anchor.prerequisites == null) {
      continue;
    }

    for (const prerequisiteId of anchor.prerequisites) {
      const prerequisiteAccumulator = courseAccumulators.get(prerequisiteId) ?? createAccumulator();
      addInferredMatch(
        prerequisiteAccumulator,
        anchor.id,
        Math.max(1.4, Math.min(3.4, anchorAccumulator.score * 0.18)),
        "course.prerequisite_inference",
      );
      courseAccumulators.set(prerequisiteId, prerequisiteAccumulator);
    }
  }

  const derivedCourseMappings: DerivedCourseSkillMapping[] = GOLDEN_PATH_SKILLS.flatMap((skill) => {
    const accumulator = courseAccumulators.get(skill.id);
    if (!accumulator || !shouldKeepCourseSkill(accumulator)) {
      return [];
    }

    return [
      {
        skillId: skill.id,
        confidence: toConfidence(accumulator.score),
        source: "heuristic" as const,
        metadata: buildMetadata(accumulator),
      },
    ];
  }).sort((left, right) => right.confidence - left.confidence);

  const courseMappings: DerivedCourseSkillMapping[] = hasExplicitCourseSkills
    ? explicitCourseSkillIds.map((skillId) => ({
        skillId,
        confidence: 100,
        source: "outline_explicit" as const,
        metadata: createExplicitMetadata(
          directExplicitCourseSkillIds.length > 0
            ? "outline.courseSkillIds"
            : "outline.chapter.skillIds",
        ),
      }))
    : hasExplicitChapterSkills
      ? uniqueStrings(explicitChapterSkillIds.flat()).map((skillId) => ({
          skillId,
          confidence: 100,
          source: "outline_explicit" as const,
          metadata: createExplicitMetadata("outline.chapter.skillIds", 96),
        }))
      : derivedCourseMappings;

  const topCourseSkillIds = courseMappings
    .filter(
      (mapping) =>
        mapping.source === "outline_explicit" || (mapping.metadata.matchedAliases?.length ?? 0) > 0,
    )
    .slice(0, 2)
    .map((mapping) => mapping.skillId);
  const derivedChapterMappings: DerivedCourseChapterSkillMapping[] = [];

  for (const [chapterOffset, chapter] of outline.chapters.entries()) {
    const chapterIndex = chapterOffset + 1;
    const chapterSources = buildChapterSources(chapter, chapterIndex);
    const chapterAccumulators = new Map<string, MatchAccumulator>();

    for (const skill of GOLDEN_PATH_SKILLS) {
      const accumulator = scoreSkillAgainstSources(chapterSources, skill);
      chapterAccumulators.set(skill.id, accumulator);
    }

    if (chapter.practiceType === "project") {
      const rapidPrototypeAccumulator =
        chapterAccumulators.get("rapid-prototyping") ?? createAccumulator();
      addInferredMatch(
        rapidPrototypeAccumulator,
        "project_chapter",
        3.1,
        `chapter.${chapterIndex}.project_inference`,
      );
      chapterAccumulators.set("rapid-prototyping", rapidPrototypeAccumulator);
    }

    if (isGenericChapter(chapter, chapterIndex)) {
      for (const skillId of topCourseSkillIds) {
        const chapterAccumulator = chapterAccumulators.get(skillId) ?? createAccumulator();
        addInferredMatch(
          chapterAccumulator,
          skillId,
          chapter.practiceType === "project" ? 1.8 : 2.4,
          `chapter.${chapterIndex}.course_anchor_fallback`,
        );
        chapterAccumulators.set(skillId, chapterAccumulator);
      }
    }

    for (const mapping of courseMappings.slice(0, 3)) {
      const skill = GOLDEN_PATH_SKILLS.find((item) => item.id === mapping.skillId);
      if (!skill?.prerequisites?.length) {
        continue;
      }

      const chapterAccumulator = chapterAccumulators.get(skill.id);
      if (!chapterAccumulator || chapterAccumulator.score < 4.8) {
        continue;
      }

      for (const prerequisiteId of skill.prerequisites) {
        const prerequisiteAccumulator =
          chapterAccumulators.get(prerequisiteId) ?? createAccumulator();
        addInferredMatch(
          prerequisiteAccumulator,
          skill.id,
          1.2,
          `chapter.${chapterIndex}.prerequisite_inference`,
        );
        chapterAccumulators.set(prerequisiteId, prerequisiteAccumulator);
      }
    }

    for (const skill of GOLDEN_PATH_SKILLS) {
      const accumulator = chapterAccumulators.get(skill.id);
      if (!accumulator || !shouldKeepChapterSkill(accumulator)) {
        continue;
      }

      derivedChapterMappings.push({
        chapterIndex,
        skillId: skill.id,
        confidence: toConfidence(accumulator.score),
        source: "heuristic",
        metadata: {
          chapterTitle: chapter.title,
          ...buildMetadata(accumulator),
        },
      });
    }
  }

  const chapterMappings: DerivedCourseChapterSkillMapping[] = outline.chapters.flatMap(
    (chapter, chapterOffset) => {
      const chapterIndex = chapterOffset + 1;
      const explicitSkillIds = explicitChapterSkillIds[chapterOffset] ?? [];

      if (explicitSkillIds.length > 0) {
        return explicitSkillIds.map((skillId) => ({
          chapterIndex,
          skillId,
          confidence: 100,
          source: "outline_explicit" as const,
          metadata: {
            chapterTitle: chapter.title,
            ...createExplicitMetadata(`outline.chapter.${chapterIndex}.skillIds`),
          },
        }));
      }

      return derivedChapterMappings.filter((mapping) => mapping.chapterIndex === chapterIndex);
    },
  );

  return {
    courseMappings,
    chapterMappings: chapterMappings.sort(
      (left, right) => left.chapterIndex - right.chapterIndex || right.confidence - left.confidence,
    ),
  };
}

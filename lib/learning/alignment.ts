import type { GrowthGenerationContext } from "@/lib/growth/generation-context-format";

const TOKEN_SEGMENTER = new Intl.Segmenter("zh-Hans", { granularity: "word" });
const STOP_TOKENS = new Set([
  "的",
  "了",
  "和",
  "与",
  "及",
  "在",
  "把",
  "对",
  "是",
  "让",
  "课程",
  "章节",
  "小节",
  "学习",
  "能力",
  "当前",
]);

export type LearningAlignmentRelation = "direct" | "supporting" | "exploratory" | "unscoped";

export interface LearningAlignmentBrief {
  relation: LearningAlignmentRelation;
  directionTitle: string | null;
  focusTitle: string | null;
  focusState: string | null;
  focusProgress: number | null;
  relevantInsightTitles: string[];
  summary: string;
  emphasis: string[];
}

export interface CourseBlueprintAlignmentBrief {
  relation: LearningAlignmentRelation;
  directionTitle: string | null;
  focusTitle: string | null;
  relevantInsightTitles: string[];
  summary: string;
  emphasis: string[];
}

interface BuildLearningAlignmentInput {
  chapterTitle: string;
  chapterDescription?: string | null;
  chapterSkillIds?: string[] | null;
  courseSkillIds?: string[] | null;
  sectionTitle?: string | null;
  sectionDescription?: string | null;
  generationContext?: GrowthGenerationContext | null;
}

function tokenize(value: string): string[] {
  return [...TOKEN_SEGMENTER.segment(value)]
    .map((segment) => segment.segment.trim().toLowerCase())
    .map((segment) => segment.replace(/[^\p{L}\p{N}]+/gu, ""))
    .filter((segment) => segment.length > 0 && !STOP_TOKENS.has(segment));
}

function buildTokenSet(parts: Array<string | null | undefined>): Set<string> {
  return new Set(parts.flatMap((part) => (part ? tokenize(part) : [])));
}

function getOverlapScore(base: Set<string>, candidate: Set<string>): number {
  if (base.size === 0 || candidate.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of candidate) {
    if (base.has(token)) {
      overlap += 1;
    }
  }

  return overlap / candidate.size;
}

function getRelationLabel(relation: LearningAlignmentRelation): string {
  switch (relation) {
    case "direct":
      return "直接推进";
    case "supporting":
      return "支撑前置";
    case "exploratory":
      return "弱关联扩展";
    case "unscoped":
      return "按课程主线";
  }
}

function pickRelevantInsights(
  chapterTokens: Set<string>,
  insights: GrowthGenerationContext["insights"],
): string[] {
  if (insights.length === 0) {
    return [];
  }

  return insights
    .map((insight) => ({
      title: insight.title,
      confidence: insight.confidence,
      score: getOverlapScore(
        chapterTokens,
        buildTokenSet([insight.title, insight.summary, insight.kind]),
      ),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.confidence - left.confidence;
    })
    .filter((item, index) => item.score >= 0.08 || index === 0)
    .slice(0, 2)
    .map((item) => item.title);
}

function buildSummary(params: {
  relation: LearningAlignmentRelation;
  directionTitle: string | null;
  focusTitle: string | null;
  relevantInsightTitles: string[];
}): string {
  const { relation, directionTitle, focusTitle, relevantInsightTitles } = params;
  const signalsText =
    relevantInsightTitles.length > 0 ? `，同时呼应 ${relevantInsightTitles.join("、")}` : "";

  switch (relation) {
    case "direct":
      return focusTitle
        ? `当前内容直接推进「${focusTitle}」${signalsText}。`
        : `当前内容直接服务于当前成长主线${signalsText}。`;
    case "supporting":
      return focusTitle
        ? `当前内容更像「${focusTitle}」的支撑能力或前置台阶${signalsText}。`
        : `当前内容主要作为当前方向的支撑能力${signalsText}。`;
    case "exploratory":
      return directionTitle
        ? `当前内容与主方向「${directionTitle}」有关，但更适合作为边界清晰的补充扩展${signalsText}。`
        : `当前内容和现有成长信号关联偏弱，应回到课程主线来讲${signalsText}。`;
    case "unscoped":
      return `当前没有明确成长焦点，应优先围绕课程学习成果和本章能力目标来讲。`;
  }
}

function buildCourseBlueprintSummary(params: {
  relation: LearningAlignmentRelation;
  directionTitle: string | null;
  focusTitle: string | null;
  relevantInsightTitles: string[];
}): string {
  const { relation, directionTitle, focusTitle, relevantInsightTitles } = params;
  const signalsText =
    relevantInsightTitles.length > 0 ? `，并呼应 ${relevantInsightTitles.join("、")}` : "";

  switch (relation) {
    case "direct":
      return focusTitle
        ? `这门课应直接推进当前焦点「${focusTitle}」${signalsText}。`
        : `这门课应直接服务当前成长主线${signalsText}。`;
    case "supporting":
      return focusTitle
        ? `这门课更适合为「${focusTitle}」补齐关键前置与支撑能力${signalsText}。`
        : `这门课应作为当前方向的支撑型课程${signalsText}。`;
    case "exploratory":
      return directionTitle
        ? `这门课与当前方向「${directionTitle}」存在关联，但应保持边界清晰，不要喧宾夺主${signalsText}。`
        : `这门课与当前成长信号关联偏弱，应优先尊重用户显式目标${signalsText}。`;
    case "unscoped":
      return "当前没有稳定成长焦点，应优先尊重用户显式目标与课程主题。";
  }
}

function buildEmphasis(params: {
  relation: LearningAlignmentRelation;
  focusTitle: string | null;
  sectionTitle?: string | null;
  relevantInsightTitles: string[];
}): string[] {
  const { relation, focusTitle, sectionTitle, relevantInsightTitles } = params;
  const sectionLine = sectionTitle
    ? `把「${sectionTitle}」讲成一个能落地执行的能力片段，不要只停在概念定义。`
    : "把当前内容讲成一个能落地执行的能力片段，不要只停在概念定义。";
  const insightLine =
    relevantInsightTitles.length > 0
      ? `回答或写作时要主动呼应 ${relevantInsightTitles.join("、")} 这些近期成长信号。`
      : "如果没有明确成长信号，就优先围绕本章能力目标和课程学习成果展开。";

  switch (relation) {
    case "direct":
      return [
        focusTitle
          ? `明确说明当前内容如何直接推进「${focusTitle}」，以及学完后应该能多做什么。`
          : "明确说明当前内容如何推进当前成长主线，以及学完后应该能多做什么。",
        sectionLine,
        insightLine,
      ];
    case "supporting":
      return [
        focusTitle
          ? `把当前内容讲成推进「${focusTitle}」之前必须补齐的前置能力或支撑能力。`
          : "把当前内容讲成当前成长方向的支撑能力，而不是孤立知识点。",
        "强调学习顺序、依赖关系、常见断层和补齐方法。",
        insightLine,
      ];
    case "exploratory":
      return [
        "先讲清楚这部分内容和当前主线的边界，再补充它为什么仍值得学。",
        "避免把篇幅扩张成和当前课程主线无关的大话题。",
        insightLine,
      ];
    case "unscoped":
      return [
        "没有明确成长焦点时，优先围绕课程学习成果、本章能力目标和实际使用场景组织内容。",
        sectionLine,
        insightLine,
      ];
  }
}

function buildCourseBlueprintEmphasis(params: {
  relation: LearningAlignmentRelation;
  focusTitle: string | null;
  relevantInsightTitles: string[];
}): string[] {
  const { relation, focusTitle, relevantInsightTitles } = params;
  const insightLine =
    relevantInsightTitles.length > 0
      ? `课程结构要主动回应 ${relevantInsightTitles.join("、")} 这些近期成长信号。`
      : "如果没有明显成长信号，就以用户当前显式目标和课程主题为首要约束。";

  switch (relation) {
    case "direct":
      return [
        focusTitle
          ? `课程前半段就要开始推进「${focusTitle}」，不要把关键能力拖到后面。`
          : "课程前半段就要进入当前主线最关键的能力推进，不要过度铺垫。",
        "章节组织要突出能力成长顺序，而不是平均分配知识点。",
        insightLine,
      ];
    case "supporting":
      return [
        focusTitle
          ? `课程应优先补齐推进「${focusTitle}」前必须掌握的前置能力。`
          : "课程前半段应优先补齐当前方向的决定性前置能力。",
        "先修要求、章节顺序和练习形式都要围绕补短板来组织。",
        insightLine,
      ];
    case "exploratory":
      return [
        "保留课程主题的独立价值，但要明确它和当前主线的连接点。",
        "不要把课程硬改造成与用户当前目标无关的新方向课程。",
        insightLine,
      ];
    case "unscoped":
      return [
        "优先尊重用户当前明确目标，不要让系统偏好压过用户意图。",
        "课程结构应围绕可执行成果和能力推进来组织，而不是泛泛铺陈。",
        insightLine,
      ];
  }
}

export function buildLearningAlignmentBrief(
  input: BuildLearningAlignmentInput,
): LearningAlignmentBrief {
  const chapterTokens = buildTokenSet([
    input.chapterTitle,
    input.chapterDescription,
    input.sectionTitle,
    input.sectionDescription,
    ...(input.chapterSkillIds ?? []),
    ...(input.courseSkillIds ?? []),
  ]);
  const focusTokens = buildTokenSet([
    input.generationContext?.currentFocus?.title,
    input.generationContext?.currentFocus?.summary,
  ]);
  const directionTokens = buildTokenSet([
    input.generationContext?.currentDirection?.title,
    input.generationContext?.currentDirection?.summary,
    input.generationContext?.currentDirection?.whyThisDirection,
  ]);
  const insights = input.generationContext?.insights ?? [];
  const relevantInsightTitles = pickRelevantInsights(chapterTokens, insights);
  const insightTokens = buildTokenSet(
    insights.flatMap((insight) => [insight.title, insight.summary, insight.kind]),
  );

  const focusOverlap = getOverlapScore(chapterTokens, focusTokens);
  const directionOverlap = getOverlapScore(chapterTokens, directionTokens);
  const insightOverlap = getOverlapScore(chapterTokens, insightTokens);
  const hasFocus = Boolean(input.generationContext?.currentFocus?.title);
  const hasDirection = Boolean(input.generationContext?.currentDirection?.title);

  let relation: LearningAlignmentRelation = "unscoped";
  if (hasFocus || hasDirection) {
    if (focusOverlap >= 0.14) {
      relation = "direct";
    } else if (
      directionOverlap >= 0.12 ||
      insightOverlap >= 0.1 ||
      (hasFocus && (input.chapterSkillIds?.length ?? 0) > 0)
    ) {
      relation = "supporting";
    } else {
      relation = "exploratory";
    }
  }

  const directionTitle = input.generationContext?.currentDirection?.title ?? null;
  const focusTitle = input.generationContext?.currentFocus?.title ?? null;

  return {
    relation,
    directionTitle,
    focusTitle,
    focusState: input.generationContext?.currentFocus?.state ?? null,
    focusProgress: input.generationContext?.currentFocus?.progress ?? null,
    relevantInsightTitles,
    summary: buildSummary({
      relation,
      directionTitle,
      focusTitle,
      relevantInsightTitles,
    }),
    emphasis: buildEmphasis({
      relation,
      focusTitle,
      sectionTitle: input.sectionTitle,
      relevantInsightTitles,
    }),
  };
}

export function buildCourseBlueprintAlignmentBrief(input: {
  courseTitle: string;
  courseDescription?: string | null;
  courseSkillIds?: string[] | null;
  chapterTitles?: string[] | null;
  chapterSkillIds?: string[] | null;
  generationContext?: GrowthGenerationContext | null;
}): CourseBlueprintAlignmentBrief {
  const courseTokens = buildTokenSet([
    input.courseTitle,
    input.courseDescription,
    ...(input.courseSkillIds ?? []),
    ...(input.chapterTitles ?? []),
    ...(input.chapterSkillIds ?? []),
  ]);
  const focusTokens = buildTokenSet([
    input.generationContext?.currentFocus?.title,
    input.generationContext?.currentFocus?.summary,
  ]);
  const directionTokens = buildTokenSet([
    input.generationContext?.currentDirection?.title,
    input.generationContext?.currentDirection?.summary,
    input.generationContext?.currentDirection?.whyThisDirection,
  ]);
  const insights = input.generationContext?.insights ?? [];
  const relevantInsightTitles = pickRelevantInsights(courseTokens, insights);
  const insightTokens = buildTokenSet(
    insights.flatMap((insight) => [insight.title, insight.summary, insight.kind]),
  );

  const focusOverlap = getOverlapScore(courseTokens, focusTokens);
  const directionOverlap = getOverlapScore(courseTokens, directionTokens);
  const insightOverlap = getOverlapScore(courseTokens, insightTokens);
  const hasFocus = Boolean(input.generationContext?.currentFocus?.title);
  const hasDirection = Boolean(input.generationContext?.currentDirection?.title);

  let relation: LearningAlignmentRelation = "unscoped";
  if (hasFocus || hasDirection) {
    if (focusOverlap >= 0.12) {
      relation = "direct";
    } else if (
      directionOverlap >= 0.1 ||
      insightOverlap >= 0.08 ||
      (hasFocus && (input.courseSkillIds?.length ?? 0) > 0)
    ) {
      relation = "supporting";
    } else {
      relation = "exploratory";
    }
  }

  const directionTitle = input.generationContext?.currentDirection?.title ?? null;
  const focusTitle = input.generationContext?.currentFocus?.title ?? null;

  return {
    relation,
    directionTitle,
    focusTitle,
    relevantInsightTitles,
    summary: buildCourseBlueprintSummary({
      relation,
      directionTitle,
      focusTitle,
      relevantInsightTitles,
    }),
    emphasis: buildCourseBlueprintEmphasis({
      relation,
      focusTitle,
      relevantInsightTitles,
    }),
  };
}

export function formatLearningAlignmentBrief(
  brief: LearningAlignmentBrief,
  style: "prompt" | "compact" = "prompt",
): string {
  if (style === "compact") {
    return [
      `对齐关系：${getRelationLabel(brief.relation)}`,
      brief.focusTitle ? `当前焦点：${brief.focusTitle}` : null,
      brief.directionTitle ? `当前方向：${brief.directionTitle}` : null,
      `摘要：${brief.summary}`,
    ]
      .filter(Boolean)
      .join("；");
  }

  return [
    `- 对齐关系：${getRelationLabel(brief.relation)}`,
    brief.directionTitle ? `- 当前方向：${brief.directionTitle}` : null,
    brief.focusTitle ? `- 当前焦点：${brief.focusTitle}` : null,
    brief.focusState ? `- 焦点状态：${brief.focusState} / ${brief.focusProgress ?? 0}%` : null,
    brief.relevantInsightTitles.length > 0
      ? `- 关联成长信号：${brief.relevantInsightTitles.join("、")}`
      : null,
    `- 对齐摘要：${brief.summary}`,
    "- 本次重点：",
    ...brief.emphasis.map((item) => `  - ${item}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatCourseBlueprintAlignmentBrief(brief: CourseBlueprintAlignmentBrief): string {
  return [
    `- 对齐关系：${getRelationLabel(brief.relation)}`,
    brief.directionTitle ? `- 当前方向：${brief.directionTitle}` : null,
    brief.focusTitle ? `- 当前焦点：${brief.focusTitle}` : null,
    brief.relevantInsightTitles.length > 0
      ? `- 关联成长信号：${brief.relevantInsightTitles.join("、")}`
      : null,
    `- 对齐摘要：${brief.summary}`,
    "- 本次课程蓝图重点：",
    ...brief.emphasis.map((item) => `  - ${item}`),
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildLearnQuickPrompts(params: {
  chapterTitle?: string | null;
  sectionTitle?: string | null;
}): string[] {
  if (params.sectionTitle) {
    return [
      `这一节「${params.sectionTitle}」最重要的三个要点是什么？`,
      "帮我用一个例子讲透这一节。",
      "这一节最容易混淆或踩坑的地方是什么？",
      "我学完这一节应该能做出什么？",
    ];
  }

  const prompts = [
    params.chapterTitle ? `这一章「${params.chapterTitle}」最重要的三个要点是什么？` : null,
    params.chapterTitle ? `这一章适合怎么学，先看哪里再练哪里？` : null,
    params.chapterTitle ? `帮我用一个例子讲透这一章。` : null,
    params.chapterTitle ? `这一章里最容易混淆或踩坑的地方是什么？` : null,
  ];

  return [...new Set(prompts.filter((prompt): prompt is string => Boolean(prompt)))].slice(0, 4);
}

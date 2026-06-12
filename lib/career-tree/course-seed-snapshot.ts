import { createHash } from "node:crypto";
import { CAREER_TREE_SCHEMA_VERSION, MAX_CAREER_TREES } from "@/lib/career-tree/constants";
import {
  type CareerCourseProgress,
  type CareerCourseSource,
  getCareerCourseProgressMap,
  getCareerCourseSource,
  listCareerCourseSourcesForUser,
  type NormalizedCareerOutlineChapter,
} from "@/lib/career-tree/source";
import type {
  CandidateCareerTree,
  CareerNodeState,
  CareerTreeSnapshot,
  SupportingChapterRef,
  SupportingCourseRef,
  VisibleSkillTreeNode,
} from "@/lib/career-tree/types";

const MAX_SEED_COURSES = 12;
const MAX_SEED_DIRECTIONS = 4;
const MAX_CHAPTER_NODES_PER_TREE = 6;
const MAX_SECTION_CHILDREN_PER_NODE = 3;

const AI_TOPIC_PATTERN =
  /ai|人工智能|大模型|llm|agent|智能体|prompt|提示词|rag|模型|机器学习|深度学习|多模态|推理|qwen|deepseek|openai/iu;
const PRODUCT_TOPIC_PATTERN = /产品|增长|用户|商业|需求|运营|市场|策略|转化|体验|设计|增长/iu;
const DATA_TOPIC_PATTERN = /数据|分析|sql|bi|指标|可视化|统计|python|报表|数据仓库|数据科学/iu;
const FRONTEND_TOPIC_PATTERN = /前端|react|next|vue|typescript|javascript|css|交互|页面|组件/iu;

interface SeedCareerTheme {
  key: string;
  title: string;
  summary: string;
  whyThisDirection: string;
  nextRole: string;
  laterRole: string;
  matcher: RegExp;
}

interface CourseSeedCandidate {
  source: CareerCourseSource;
  score: number;
}

const CAREER_THEMES: SeedCareerTheme[] = [
  {
    key: "ai-application-engineer",
    title: "AI 应用工程师",
    summary: "把模型、工具调用、检索和产品场景连接成可交付的 AI 应用。",
    whyThisDirection: "课程信号集中在 AI、模型、智能体或 RAG，适合先走工程化落地方向。",
    nextRole: "AI 应用开发工程师",
    laterRole: "智能体系统架构师",
    matcher: AI_TOPIC_PATTERN,
  },
  {
    key: "ai-product-manager",
    title: "AI 产品经理",
    summary: "把用户问题、模型能力和业务指标翻译成可验证的 AI 产品方案。",
    whyThisDirection: "课程同时出现 AI 和产品/用户/商业信号，适合评估 AI 产品路线。",
    nextRole: "AI 产品经理",
    laterRole: "AI 解决方案负责人",
    matcher:
      /(?=.*(?:ai|人工智能|大模型|llm|智能体|模型))(?=.*(?:产品|用户|商业|需求|运营|增长|体验))/iu,
  },
  {
    key: "data-analyst",
    title: "数据分析师",
    summary: "用数据建模、指标体系和业务解释支撑决策。",
    whyThisDirection: "课程信号包含数据、SQL、分析或可视化，适合形成数据驱动岗位路径。",
    nextRole: "业务数据分析师",
    laterRole: "数据产品经理",
    matcher: DATA_TOPIC_PATTERN,
  },
  {
    key: "frontend-engineer",
    title: "前端工程师",
    summary: "负责产品界面、交互体验和前端工程质量。",
    whyThisDirection: "课程信号包含前端框架、组件、交互或 TypeScript，适合走前端工程路径。",
    nextRole: "前端开发工程师",
    laterRole: "前端架构师",
    matcher: FRONTEND_TOPIC_PATTERN,
  },
  {
    key: "product-operations-specialist",
    title: "产品运营专家",
    summary: "围绕用户增长、内容转化和业务策略设计可执行动作。",
    whyThisDirection: "课程信号偏产品、增长、运营或用户研究，适合走产品运营路径。",
    nextRole: "产品运营专员",
    laterRole: "增长产品经理",
    matcher: PRODUCT_TOPIC_PATTERN,
  },
];

function compactText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function clampText(value: string, maxLength: number): string {
  const compacted = compactText(value);
  if (compacted.length <= maxLength) {
    return compacted;
  }

  return `${compacted.slice(0, maxLength - 1).trim()}…`;
}

function stableId(parts: string[]): string {
  return createHash("sha1").update(parts.join(":")).digest("hex").slice(0, 12);
}

function normalizeSearchText(source: CareerCourseSource): string {
  return [
    source.title,
    source.description,
    source.outline.title,
    source.outline.description,
    source.outline.courseSkillIds.join(" "),
    source.outline.prerequisites.join(" "),
    ...source.outline.chapters.flatMap((chapter) => [
      chapter.title,
      chapter.description,
      chapter.explicitSkillIds.join(" "),
      ...chapter.sections.flatMap((section) => [section.title, section.description]),
    ]),
  ]
    .filter(Boolean)
    .join(" ");
}

function scoreThemeForCourse(theme: SeedCareerTheme, source: CareerCourseSource): number {
  const text = normalizeSearchText(source);
  if (!theme.matcher.test(text)) {
    return 0;
  }

  const titleBoost = theme.matcher.test(source.title) ? 4 : 0;
  const chapterHits = source.outline.chapters.filter((chapter) =>
    theme.matcher.test(`${chapter.title} ${chapter.description}`),
  ).length;
  return 6 + titleBoost + Math.min(8, chapterHits * 2);
}

function resolveChapterProgress(
  progress: CareerCourseProgress | undefined,
  chapter: NormalizedCareerOutlineChapter,
): number {
  if (!progress) {
    return 0;
  }

  if (progress.completedChapters.includes(chapter.chapterIndex)) {
    return 100;
  }

  if (chapter.sections.length === 0) {
    return 0;
  }

  const completedSectionCount = chapter.sections.filter((section) =>
    progress.completedSections.includes(section.sectionKey),
  ).length;
  return Math.round((completedSectionCount / chapter.sections.length) * 100);
}

function resolveNodeState(progress: number, index: number): CareerNodeState {
  if (progress >= 80) {
    return "mastered";
  }

  if (progress >= 25) {
    return "in_progress";
  }

  return index <= 1 ? "ready" : "locked";
}

function toSupportingCourseRef(source: CareerCourseSource): SupportingCourseRef {
  return {
    courseId: source.id,
    title: source.title,
  };
}

function toSupportingChapterRef(
  source: CareerCourseSource,
  chapter: NormalizedCareerOutlineChapter,
): SupportingChapterRef {
  return {
    courseId: source.id,
    chapterKey: chapter.chapterKey,
    chapterIndex: chapter.chapterIndex,
    title: chapter.title,
  };
}

function buildChapterNode(params: {
  theme: SeedCareerTheme;
  source: CareerCourseSource;
  chapter: NormalizedCareerOutlineChapter;
  progress: number;
  index: number;
}): VisibleSkillTreeNode {
  const { theme, source, chapter, progress, index } = params;
  const anchorRef = `course:${source.id}:chapter:${chapter.chapterKey}`;
  const supportingCourse = toSupportingCourseRef(source);
  const supportingChapter = toSupportingChapterRef(source, chapter);
  const sectionChildren = chapter.sections
    .slice(0, MAX_SECTION_CHILDREN_PER_NODE)
    .map((section) => {
      const sectionAnchorRef = `course:${source.id}:section:${section.sectionKey}`;
      return {
        id: `${theme.key}:section:${stableId([sectionAnchorRef])}`,
        anchorRef: sectionAnchorRef,
        title: section.title,
        summary: clampText(section.description || `围绕「${section.title}」形成可迁移能力。`, 120),
        progress: progress >= 100 ? 100 : 0,
        state: progress >= 100 ? ("mastered" as const) : ("ready" as const),
        children: [],
        supportingCourses: [supportingCourse],
        supportingChapters: [supportingChapter],
      };
    });

  return {
    id: `${theme.key}:chapter:${stableId([anchorRef])}`,
    anchorRef,
    title: chapter.title,
    summary: clampText(chapter.description || `来自《${source.title}》的核心学习信号。`, 150),
    progress,
    state: resolveNodeState(progress, index),
    children: sectionChildren,
    supportingCourses: [supportingCourse],
    supportingChapters: [supportingChapter],
  };
}

function getRepresentativeChapters(source: CareerCourseSource): NormalizedCareerOutlineChapter[] {
  return source.outline.chapters
    .filter((chapter) => compactText(chapter.title).length > 0)
    .slice(0, MAX_CHAPTER_NODES_PER_TREE);
}

function buildSeedTree(
  theme: SeedCareerTheme,
  candidates: CourseSeedCandidate[],
  progressByCourseId: Map<string, CareerCourseProgress>,
): CandidateCareerTree | null {
  const selectedCandidates = candidates
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);

  if (selectedCandidates.length === 0) {
    return null;
  }

  const supportingCourses = selectedCandidates.map((candidate) =>
    toSupportingCourseRef(candidate.source),
  );
  const supportingChapters = selectedCandidates.flatMap((candidate) =>
    getRepresentativeChapters(candidate.source).map((chapter) =>
      toSupportingChapterRef(candidate.source, chapter),
    ),
  );
  const treeNodes = selectedCandidates
    .flatMap((candidate) =>
      getRepresentativeChapters(candidate.source).map((chapter) => ({
        source: candidate.source,
        chapter,
        progress: resolveChapterProgress(progressByCourseId.get(candidate.source.id), chapter),
      })),
    )
    .sort((left, right) => right.progress - left.progress)
    .slice(0, MAX_CHAPTER_NODES_PER_TREE)
    .map((item, index) =>
      buildChapterNode({
        theme,
        source: item.source,
        chapter: item.chapter,
        progress: item.progress,
        index,
      }),
    );

  if (treeNodes.length === 0) {
    return null;
  }

  const averageScore =
    selectedCandidates.reduce((sum, candidate) => sum + candidate.score, 0) /
    selectedCandidates.length;
  const confidence = Math.min(0.74, Math.max(0.42, averageScore / 18));
  const supportNodeRefs = treeNodes.map((node) => node.anchorRef);

  return {
    directionKey: theme.key,
    title: theme.title,
    summary: theme.summary,
    confidence,
    whyThisDirection: theme.whyThisDirection,
    supportingCourses,
    supportingChapters,
    progressionRoles: [
      {
        id: `${theme.key}:next`,
        title: theme.nextRole,
        summary: `近期可以把课程能力转化为「${theme.nextRole}」的作品和项目证据。`,
        horizon: "next",
        confidence,
        supportingNodeRefs: supportNodeRefs,
      },
      {
        id: `${theme.key}:later`,
        title: theme.laterRole,
        summary: `后续可沿着更高杠杆的「${theme.laterRole}」继续扩展。`,
        horizon: "later",
        confidence: Math.max(0.35, confidence - 0.08),
        supportingNodeRefs: supportNodeRefs,
      },
    ],
    tree: treeNodes,
  };
}

function buildGeneralistTheme(sources: CareerCourseSource[]): SeedCareerTheme {
  const primaryTitle = sources[0]?.title ?? "当前课程";
  return {
    key: "career-direction-generalist",
    title: "业务问题解决顾问",
    summary: "把现有课程能力整理成可迁移的职业资产，再通过访谈确定更具体岗位。",
    whyThisDirection: `当前课程以《${primaryTitle}》等学习信号为主，适合先形成可展示能力，再校准目标岗位。`,
    nextRole: "业务问题解决顾问",
    laterRole: "领域解决方案专家",
    matcher: /.*/u,
  };
}

export async function buildCourseSeedCareerTreeSnapshot(params: {
  userId: string;
  selectedDirectionKey: string | null;
}): Promise<CareerTreeSnapshot | null> {
  const refs = await listCareerCourseSourcesForUser({
    userId: params.userId,
    limit: MAX_SEED_COURSES,
  });
  const sources = (
    await Promise.all(refs.map((ref) => getCareerCourseSource(ref.userId, ref.courseId)))
  ).filter((source): source is CareerCourseSource => Boolean(source));

  if (sources.length === 0) {
    return null;
  }

  const progressByCourseId = await getCareerCourseProgressMap(
    params.userId,
    sources.map((source) => source.id),
  );
  const themeTrees = CAREER_THEMES.map((theme) => {
    const candidates = sources.map((source) => ({
      source,
      score: scoreThemeForCourse(theme, source),
    }));
    return buildSeedTree(theme, candidates, progressByCourseId);
  })
    .filter((tree): tree is CandidateCareerTree => Boolean(tree))
    .sort((left, right) => right.confidence - left.confidence);
  const trees =
    themeTrees.length > 0
      ? themeTrees.slice(0, MAX_SEED_DIRECTIONS)
      : [
          buildSeedTree(
            buildGeneralistTheme(sources),
            sources.map((source) => ({ source, score: 6 })),
            progressByCourseId,
          ),
        ].filter((tree): tree is CandidateCareerTree => Boolean(tree));

  if (trees.length === 0) {
    return null;
  }

  const directionKeys = new Set(trees.map((tree) => tree.directionKey));
  const recommendedDirectionKey = trees[0]?.directionKey ?? null;
  const selectedDirectionKey =
    params.selectedDirectionKey && directionKeys.has(params.selectedDirectionKey)
      ? params.selectedDirectionKey
      : null;

  return {
    schemaVersion: CAREER_TREE_SCHEMA_VERSION,
    status: "ready",
    recommendedDirectionKey,
    selectedDirectionKey,
    trees: trees.slice(0, MAX_CAREER_TREES),
    generatedAt: null,
  };
}

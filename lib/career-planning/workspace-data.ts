import "server-only";

import { type CareerMapDraft, careerMapDraftSchema } from "@/lib/ai/career-planning/schemas";
import {
  type CareerPlanningState,
  getLatestCareerPlanningState,
} from "@/lib/career-planning/state";
import type {
  CandidateCareerTree,
  CareerTreeSnapshot,
  VisibleSkillTreeNode,
} from "@/lib/career-tree/types";
import {
  countVisibleTreeMetrics,
  flattenVisibleNodes,
  getCurrentCareerTree,
} from "@/lib/career-tree/view-model";
import { getCareerTreeWorkspaceDataFresh } from "@/lib/career-tree/workspace-data";

export interface CareerPlanningSignal {
  label: string;
  value: string;
  detail: string;
  source: "course" | "skill_tree" | "insight";
}

export interface CareerPlanningSkillGap {
  id: string;
  title: string;
  summary: string;
  progress: number;
  state: VisibleSkillTreeNode["state"];
}

export interface CareerPlanningRoute {
  directionKey: string;
  title: string;
  summary: string;
  confidence: number;
  whyThisDirection: string;
  supportingCourses: CandidateCareerTree["supportingCourses"];
  progressionRoles: CandidateCareerTree["progressionRoles"];
  keyNodes: CareerPlanningSkillGap[];
  gapNodes: CareerPlanningSkillGap[];
}

export interface CareerPlanningWorkspaceData {
  snapshot: CareerTreeSnapshot;
  currentRoute: CareerPlanningRoute | null;
  routes: CareerPlanningRoute[];
  signals: CareerPlanningSignal[];
  starterPrompts: string[];
  metrics: ReturnType<typeof countVisibleTreeMetrics> | null;
  planningState: CareerPlanningState | null;
}

const MAX_ROUTES = 4;
const MAX_ROUTE_NODES = 5;
const MAX_PROMPT_CONTEXT_ROUTES = 3;
const MAX_INSIGHT_SIGNAL_CHARS = 180;

function toSkillGap(node: VisibleSkillTreeNode): CareerPlanningSkillGap {
  return {
    id: node.id,
    title: node.title,
    summary: node.summary,
    progress: node.progress,
    state: node.state,
  };
}

function toCareerPlanningRoute(tree: CandidateCareerTree): CareerPlanningRoute {
  const nodes = flattenVisibleNodes(tree.tree);
  const keyNodes = nodes
    .filter((node) => node.state === "mastered" || node.state === "in_progress")
    .slice(0, MAX_ROUTE_NODES)
    .map(toSkillGap);
  const gapNodes = nodes
    .filter((node) => node.state === "ready" || node.state === "locked")
    .slice(0, MAX_ROUTE_NODES)
    .map(toSkillGap);

  return {
    directionKey: tree.directionKey,
    title: tree.title,
    summary: tree.summary,
    confidence: tree.confidence,
    whyThisDirection: tree.whyThisDirection,
    supportingCourses: tree.supportingCourses.slice(0, 5),
    progressionRoles: tree.progressionRoles.slice(0, 4),
    keyNodes,
    gapNodes,
  };
}

function compactWhitespace(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function stripMarkdownSyntax(value: string): string {
  return compactWhitespace(
    value
      .replace(/```[\s\S]*?```/gu, " ")
      .replace(/`([^`]+)`/gu, "$1")
      .replace(/\*\*([^*]+)\*\*/gu, "$1")
      .replace(/^\s{0,3}#{1,6}\s*/gmu, "")
      .replace(/^\s*[-*]\s+/gmu, "")
      .replace(/^\s*\d+\.\s+/gmu, ""),
  );
}

function clampText(value: string, maxLength: number): string {
  const normalized = compactWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function compactInsightTitle(title: string): string {
  return stripMarkdownSyntax(title)
    .replace(/^第\s*\d+\s*章\s*[·:：-]\s*/u, "")
    .replace(/\s*·\s*这一章.*$/u, "")
    .trim();
}

function extractInsightTopics(summary: string): string[] {
  const topics = Array.from(summary.matchAll(/^#{2,4}\s*(?:\d+[.)、]\s*)?(.+)$/gmu))
    .map((match) => stripMarkdownSyntax(match[1] ?? ""))
    .map((topic) => topic.trim())
    .filter((topic) => topic.length > 0 && !/建议|总结|如何.*扎实/u.test(topic));

  return Array.from(new Set(topics)).slice(0, 3);
}

function toCompactInsightSignal(insight: { title: string; summary: string }): string {
  const title = compactInsightTitle(insight.title);
  const topics = extractInsightTopics(insight.summary);

  if (topics.length > 0) {
    return clampText(`${title}: ${topics.join("、")}。`, MAX_INSIGHT_SIGNAL_CHARS);
  }

  const summary = stripMarkdownSyntax(insight.summary)
    .replace(/^课程[:：].*?学习对话沉淀[:：]\s*/u, "")
    .replace(/^我[:：].*?AI[:：]\s*/u, "");
  const detail = title && !summary.includes(title) ? `${title}: ${summary}` : summary;

  return clampText(detail, MAX_INSIGHT_SIGNAL_CHARS);
}

function toDraftSource(
  source: CareerPlanningSignal["source"],
): CareerMapDraft["observations"][number]["source"] {
  return source === "skill_tree" ? "skill_tree" : source;
}

function buildDraftNextActions(route: CareerPlanningRoute): string[] {
  const actions = route.gapNodes
    .slice(0, 2)
    .map((node) => clampText(`用一个小作品验证：${node.title}`, 140));

  if (actions.length > 0) {
    return actions;
  }

  return ["用一轮真实交付验证这条路线是否适合继续投入。"];
}

export function buildCareerMapDraftFromWorkspaceData(input: {
  data: CareerPlanningWorkspaceData;
  latestUserMessage?: string;
}): CareerMapDraft | null {
  const { data } = input;

  if (data.snapshot.status !== "ready" || !data.currentRoute || data.routes.length === 0) {
    return null;
  }

  const selectedRouteKey = data.planningState?.selectedRouteKey ?? data.currentRoute.directionKey;
  const selectedRoute =
    data.routes.find((route) => route.directionKey === selectedRouteKey) ?? data.currentRoute;
  const asksComparison = /比较|取舍|备选|区别/u.test(input.latestUserMessage ?? "");
  const routeOptions = data.routes.slice(0, 3).map((route) => route.title);
  const nextQuestion = asksComparison
    ? "如果只看未来一个月，你更想把哪条路线做成可展示成果？"
    : "你现在更想优先跑通哪一种最小可交付原型？";

  const draft = {
    message: `先按“${selectedRoute.title}”做一版职业地图校准。`,
    selectedRouteKey: selectedRoute.directionKey,
    observations: data.signals.slice(0, 4).map((signal) => ({
      title: clampText(signal.label, 80),
      summary: clampText(`${signal.value}: ${signal.detail}`, 220),
      source: toDraftSource(signal.source),
    })),
    routes: data.routes.slice(0, 4).map((route) => {
      const topGap = route.gapNodes[0]?.title ?? "真实交付证据";

      return {
        directionKey: route.directionKey,
        title: clampText(route.title, 100),
        summary: clampText(route.summary, 260),
        fitScore: Math.round(route.confidence * 100),
        reason: clampText(route.whyThisDirection, 280),
        risk: clampText(`如果不补齐“${topGap}”，这条路线容易停留在判断层。`, 220),
        gaps: route.gapNodes.slice(0, 5).map((node) => clampText(node.title, 100)),
        nextActions: buildDraftNextActions(route),
      };
    }),
    openQuestions: [nextQuestion],
    nextQuestion: {
      question: nextQuestion,
      why: "这个答案会决定先补系统层、产品层，还是前端工程基座。",
      options: asksComparison ? routeOptions : ["AI 编排原型", "AI 前端工作台", "前端工程基座"],
    },
  };

  const parsed = careerMapDraftSchema.safeParse(draft);
  return parsed.success ? parsed.data : null;
}

function buildSignals(input: {
  currentTree: CandidateCareerTree | null;
  currentRoute: CareerPlanningRoute | null;
  insightSummaries: string[];
}): CareerPlanningSignal[] {
  const signals: CareerPlanningSignal[] = [];

  if (input.currentTree) {
    signals.push({
      label: "当前主线",
      value: input.currentTree.title,
      detail: input.currentTree.whyThisDirection,
      source: "skill_tree",
    });
  }

  if (input.currentRoute && input.currentRoute.supportingCourses.length > 0) {
    signals.push({
      label: "课程证据",
      value: `${input.currentRoute.supportingCourses.length} 门课程`,
      detail: input.currentRoute.supportingCourses.map((course) => course.title).join(" / "),
      source: "course",
    });
  }

  const primarySkill = input.currentRoute?.keyNodes[0];
  if (primarySkill) {
    signals.push({
      label: "已显现能力",
      value: primarySkill.title,
      detail: primarySkill.summary,
      source: "skill_tree",
    });
  }

  for (const summary of input.insightSummaries.slice(0, 2)) {
    signals.push({
      label: "学习洞察",
      value: "近期信号",
      detail: summary,
      source: "insight",
    });
  }

  return signals.slice(0, 5);
}

function buildStarterPrompts(currentRoute: CareerPlanningRoute | null): string[] {
  if (!currentRoute) {
    return [
      "先根据我已有课程，帮我判断可能的职业方向",
      "你先问我几个问题，帮我把职业方向看清楚",
      "我还没有明确目标，先从学习记录里推断",
    ];
  }

  return [
    `基于“${currentRoute.title}”，先帮我确认这条路线是不是真的适合我`,
    "你先从课程信号出发，问我一个最关键的问题",
    "帮我比较当前路线和备选路线的取舍",
  ];
}

export async function getCareerPlanningWorkspaceDataFresh(
  userId: string,
): Promise<CareerPlanningWorkspaceData> {
  const [workspace, planningState] = await Promise.all([
    getCareerTreeWorkspaceDataFresh(userId, 4),
    getLatestCareerPlanningState(userId),
  ]);
  const currentTree = getCurrentCareerTree(workspace.snapshot);
  const routes = workspace.snapshot.trees.slice(0, MAX_ROUTES).map(toCareerPlanningRoute);
  const planningRoute = routes.find(
    (route) => route.directionKey === planningState?.selectedRouteKey,
  );
  const currentRoute =
    planningRoute ??
    routes.find((route) => route.directionKey === currentTree?.directionKey) ??
    routes[0] ??
    null;
  const metrics = currentTree ? countVisibleTreeMetrics(currentTree.tree) : null;
  const signals = buildSignals({
    currentTree,
    currentRoute,
    insightSummaries: workspace.insights.map(toCompactInsightSignal),
  });

  return {
    snapshot: workspace.snapshot,
    currentRoute,
    routes,
    signals,
    starterPrompts: buildStarterPrompts(currentRoute),
    metrics,
    planningState,
  };
}

export async function buildCareerPlanningPromptContext(userId: string): Promise<string> {
  const data = await getCareerPlanningWorkspaceDataFresh(userId);

  if (data.snapshot.status === "empty") {
    return [
      "## 职业访谈模式",
      "用户当前还没有可用课程职业树。不要要求用户填写一大堆资料；先用咨询师风格了解他最近想学什么、为什么想变动、希望工作状态如何。",
      "如果用户有明确学习方向，引导他先生成课程；如果用户已经有经历，可以先做轻量职业澄清，但不要假装已有课程证据。",
    ].join("\n");
  }

  if (data.snapshot.status === "pending") {
    return [
      "## 职业访谈模式",
      "用户已经有课程信号，但职业树还在整理。先说明你会基于已保存课程做初步观察，再通过少量问题校准方向。",
      "不要要求用户一次性提供完整背景；每轮只问一个会改变路线判断的问题。",
    ].join("\n");
  }

  const promptPayload = {
    currentRoute: data.currentRoute,
    candidateRoutes: data.routes.slice(0, MAX_PROMPT_CONTEXT_ROUTES),
    courseSignals: data.signals,
    metrics: data.metrics,
    planningState: data.planningState,
  };

  return [
    "## 职业访谈模式",
    "这是一个课程驱动的职业规划访谈，不是普通职业问答。",
    "你要先基于课程、职业树、学习洞察提出观察和假设，再用少量高质量问题帮助用户校准自己。",
    "不要让用户一次性提供学历、年限、薪资、城市、目标等一大堆信息；每轮只问一个真正影响判断的问题。",
    "不要把用户主观偏好说成已掌握能力；能力结论必须锚定课程或技能树证据。",
    "每轮都必须先调用 presentCareerMapDraft 输出结构化职业地图，即使只是确认当前判断；不要只在正文里讲完。",
    "正文不要复述完整地图；最多三句话，不使用编号列表；选项和取舍放进 presentCareerMapDraft.nextQuestion.options。",
    "回答结构优先是：一句课程观察 -> 一句当前假设 -> 一个会改变路线判断的问题。",
    "## 当前课程驱动画像",
    JSON.stringify(promptPayload, null, 2),
  ].join("\n\n");
}

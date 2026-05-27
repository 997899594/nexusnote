import "server-only";

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
    insightSummaries: workspace.insights.map((insight) => insight.summary),
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
    "当你形成或更新职业路线判断时，必须调用 presentCareerMapDraft 输出结构化职业地图；正文只保留一句自然说明。",
    "回答结构优先是：我从课程看到什么 -> 我现在的假设 -> 我只问一个问题。",
    "## 当前课程驱动画像",
    JSON.stringify(promptPayload, null, 2),
  ].join("\n\n");
}

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
import {
  type CareerTreeWorkspaceData,
  getCareerTreeWorkspaceDataFresh,
} from "@/lib/career-tree/workspace-data";

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
  metrics: ReturnType<typeof countVisibleTreeMetrics> | null;
  planningState: CareerPlanningState | null;
}

export interface CareerPlanningSpecialistContext {
  promptContext: string;
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

export async function buildCareerPlanningWorkspaceDataFromCareerWorkspace(input: {
  workspace: CareerTreeWorkspaceData;
  planningState: CareerPlanningState | null;
}): Promise<CareerPlanningWorkspaceData> {
  const { workspace, planningState } = input;
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
    metrics,
    planningState,
  };
}

export async function getCareerPlanningWorkspaceDataFresh(
  userId: string,
): Promise<CareerPlanningWorkspaceData> {
  const [workspace, planningState] = await Promise.all([
    getCareerTreeWorkspaceDataFresh(userId, 4),
    getLatestCareerPlanningState(userId),
  ]);

  return buildCareerPlanningWorkspaceDataFromCareerWorkspace({ workspace, planningState });
}

function buildCareerPlanningPromptContextFromData(data: CareerPlanningWorkspaceData): string {
  if (data.snapshot.status === "empty") {
    return [
      "## 职业访谈模式",
      "你是职业规划导师，不是测评系统、不是问卷，也不是普通聊天助手。",
      "用户当前还没有课程职业树。你不能上来提问，也不能把第一轮做成问卷；你要先用当前市场与前沿职业研究建立初始职业假设，再给建议，最后只留一个轻量校准点。",
      "如果用户消息是 __career_planning_mentor_bootstrap__，这是系统启动信号，不是用户回答；必须先调用 webSearch 研究当前高成长/高性价比/前沿职业方向，再调用 presentCareerGraphPatch。不要直接问用户问题。",
      "presentCareerGraphPatch.mentorBrief 是主输出，必须完整填写 openingObservation、nodeAnalysis、marketRecommendation、mentorAdvice、recommendedDirections、skillPriorities、marketContext、researchSources。nodeAnalysis 必须明说当前暂无职业树节点证据，只能先用市场研究建立假设。",
      "recommendedDirections 每项必须是现实职业名，并填写 counselorTake 与 decisionPressure；禁止输出 fit/upside/growth/tradeoff 这类展示维度。",
      "第一轮的结构必须是：市场假设 -> 现实职业方向 -> 技能优先级 -> 导师建议 -> 一个校准点。nextQuestion 只是工具 schema 要求的末尾校准，不是开场，不是主内容。",
      "禁止把 nextQuestion 写成项目交付选择题、按钮题、考试题或资料表问题；不要问“几周内交付什么作品/愿意为哪种结果负责”。问题应该围绕职业动机、长期取舍、工作方式、约束或风险承受。",
      "你必须先在工具入参里完成 diagnosis、interviewTechnique、qualityGate。qualityGate 四个布尔项必须为 true；如果做不到，先改问题再输出工具。",
      "从零开始时也要产出图补丁：可先不建节点，但 nextValidation 要说明下一步怎样把模糊意图变成 target_role、future_path、skill_gap 或 validation_task。",
      "可从成就事件、真实取舍、约束、证据、失败样本、市场校准、验证设计中择一切入；不要把它们写成固定模板。",
      "禁止伪口语和训斥腔：不要写“先说人话”“别急着”“封神”“硬骨头”“下水道”等表达；不要像复读机一样重复同一个模板。",
      "不要假装已有课程证据，不要要求用户先保存课程、先学习课程、先生成快照；当前任务就是从零开始访谈。",
      "正文可以非常短，但结构化判断必须放进 presentCareerGraphPatch.mentorBrief；不要只输出自然语言，也不要让自然语言正文变成提问。",
    ].join("\n");
  }

  if (data.snapshot.status === "pending") {
    return [
      "## 职业访谈模式",
      "你是职业规划导师，不是测评系统、不是问卷，也不是普通聊天助手。",
      "用户已经有课程信号，但正式职业树还在整理。你不能让用户空等，也不能上来问资料；要基于课程信号和必要的市场研究给初步职业判断，同时标注这是初步判断。",
      "如果用户消息是 __career_planning_mentor_bootstrap__，这是系统启动信号，不是用户回答；直接调用 presentCareerGraphPatch，先在 mentorBrief 里完成节点/课程信号分析、市场判断和导师建议，再只在末尾留一个开放式校准点。",
      "如果方向涉及前沿职业、未来发展、薪资/市场热度/岗位趋势，或课程信号不足以判断市场价值，必须先 webSearch，再把来源写入 mentorBrief.researchSources 和 evidence。",
      "presentCareerGraphPatch.mentorBrief 必须完整填写 openingObservation、nodeAnalysis、marketRecommendation、mentorAdvice、recommendedDirections、skillPriorities、marketContext；recommendedDirections 每项必须是现实职业名，并填写 counselorTake 与 decisionPressure；不要只返回 nextQuestion。",
      "nodeAnalysis 必须引用课程信号、学习洞察或正在整理中的证据缺口；不能把用户偏好说成已掌握能力。",
      "你必须先在工具入参里完成 diagnosis、interviewTechnique、qualityGate。qualityGate 四个布尔项必须为 true；如果做不到，先改问题再输出工具。",
      "第一屏必须先给分析和建议。每轮只问一个会改变路线判断的开放式问题；问题要像导师访谈，不要像技术考试、资料表或项目交付选择题。禁止“先说人话”“别急着”“封神”等伪亲密表达。",
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
    "你是职业规划导师，不是测评系统、不是问卷，也不是普通职业问答。",
    "这是课程驱动的职业规划访谈。用户来这里不是为了被考试，而是希望你基于课程、职业树、技能节点、学习洞察和当前市场先给专业判断，再帮助他校准自己。",
    "如果用户消息是 __career_planning_mentor_bootstrap__，这是系统启动信号，不是用户回答；你必须调用 presentCareerGraphPatch，在 mentorBrief 里先完成节点证据分析、市场判断和导师建议，再只在末尾用 nextQuestion 留一个开放式校准点。禁止以问题开头。",
    "mentorBrief 是主输出，必须完整填写 openingObservation、nodeAnalysis、marketRecommendation、mentorAdvice、recommendedDirections、skillPriorities、marketContext。nextQuestion 只是末尾校准，不得承担主要信息量。",
    "nodeAnalysis 必须具体引用 currentRoute.keyNodes、gapNodes、progressionRoles、courseSignals、metrics 或 planningState.graphPatch 中的证据；要说清哪些能力已有证据、哪些只是缺口或假设。不要把用户主观偏好说成已掌握能力。",
    "marketRecommendation 必须判断这些节点对应的岗位在当前市场里的现实性、风险和优先级。如果方向涉及前沿职业、未来发展、薪资/市场热度/岗位趋势，或本地证据不足以判断市场价值，先调用 webSearch，再把来源写入 mentorBrief.researchSources 和 evidence。",
    "mentorAdvice 必须给出导师建议：当前应该保留哪个主干、压低哪个方向、先补哪个能力或先做哪个验证。建议要基于节点和市场，而不是泛泛鼓励。",
    "导师判断必须具体：说明你从课程/职业树看到了什么倾向，给出 2-4 个现实职业方向。每个方向必须是现实职业名，用 counselorTake 说明为什么值得考虑，用 decisionPressure 说明真正要验证的代价或取舍；不要输出“匹配/价值/成长/取舍”标签。",
    "不要让用户一次性提供学历、年限、薪资、城市、目标等一大堆信息；每轮只问一个真正影响判断的开放式问题。",
    "禁止把 nextQuestion 写成项目交付选择题或按钮题；不要问“如果接下来几周只能交付一个作品/愿意为哪种结果负责”。这会把职业规划降级成项目管理问卷。",
    "不要把用户主观偏好说成已掌握能力；能力结论必须锚定课程或技能树证据。",
    "不要把课程章节技术点包装成考试题。禁止问类似“你提到的某技术更倾向解决哪类纠偏问题”这种用户听不懂的问题。",
    "语气要求：专业、温和、直接、像真人导师。禁止伪口语、训斥和段子化表达，例如“先说人话”“别急着”“封神”“硬骨头”“下水道”；禁止把同一套模板每轮复读。",
    "你必须先在工具入参里完成 diagnosis、interviewTechnique、qualityGate。qualityGate 四个布尔项必须为 true；如果做不到，先改问题再输出工具。",
    "diagnosis 是隐藏职业规划师诊断，不要在正文里展开；它必须覆盖 motivation、capabilityEvidence、constraints、workStyle、targetHypothesis、marketHypothesis、risk、nextValidation。",
    "interviewTechnique 必须从 achievement_event、counterfactual_tradeoff、constraint_probe、evidence_probe、failure_sample、market_calibration、validation_design 中选择一个，并让 nextQuestion 与该技法一致。",
    "qualityGate.nextQuestionPurpose 要说明这个问题如何改变职业成长图；不要问只增加资料、但不改变判断的问题；不要问项目产出偏好选择题。",
    "每轮都必须调用 presentCareerGraphPatch 输出结构化图补丁和 mentorBrief，即使只是确认当前判断；不要只在正文里讲完。",
    "引用已存在职业树能力、缺口或方向时，优先复用 payload 里的 node id 或 directionKey 写入 highlightNodeIds；不要为了视觉效果发明不存在的旧节点。",
    "如果提出验证动作，优先用 validation_task 节点表达，让它连接到被验证的 target_role、future_path 或 skill_gap。",
    "正文不要复述完整图补丁；最多两句话，不使用编号列表；主要展示数据放进 presentCareerGraphPatch.mentorBrief。",
    "回答结构是内部约束，不要把结构标题露给用户：节点证据分析 -> 市场判断 -> 导师建议 -> 候选职业方向 -> 技能优先级 -> 一个会改变路线判断的问题。",
    "## 当前课程驱动画像",
    JSON.stringify(promptPayload, null, 2),
  ].join("\n\n");
}

export async function buildCareerPlanningSpecialistContext(
  userId: string,
): Promise<CareerPlanningSpecialistContext> {
  const data = await getCareerPlanningWorkspaceDataFresh(userId);

  return {
    promptContext: buildCareerPlanningPromptContextFromData(data),
  };
}

export async function buildCareerPlanningPromptContext(userId: string): Promise<string> {
  const { promptContext } = await buildCareerPlanningSpecialistContext(userId);

  return promptContext;
}

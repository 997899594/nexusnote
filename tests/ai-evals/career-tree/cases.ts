import { CAREER_TREE_SCHEMA_VERSION } from "@/lib/career-tree/constants";
import type { CareerTreeSnapshot, VisibleSkillTreeNode } from "@/lib/career-tree/types";
import { createEvalSuite } from "../runner";
import type { CareerTreeEvalInput } from "../types";

function node(
  id: string,
  title: string,
  children: VisibleSkillTreeNode[] = [],
): VisibleSkillTreeNode {
  return {
    id,
    anchorRef: id,
    title,
    summary: `${title} 的能力证据`,
    progress: 42,
    state: "in_progress",
    children,
    evidenceRefs: [`evidence:${id}`],
  };
}

const generatedAt = "2026-05-14T00:00:00.000Z";

const progressionPreferredSnapshot: CareerTreeSnapshot = {
  schemaVersion: CAREER_TREE_SCHEMA_VERSION,
  status: "ready",
  recommendedDirectionKey: "ai-product-systems",
  selectedDirectionKey: "ai-product-systems",
  generatedAt,
  trees: [
    {
      directionKey: "ai-product-systems",
      title: "AI 产品系统设计",
      summary: "围绕产品判断、agent 工作流和系统交付形成职业主线。",
      confidence: 0.89,
      whyThisDirection: "课程证据集中在产品定义、工作流设计和系统落地。",
      supportingCourses: [{ courseId: "course-1", title: "AI 产品系统课" }],
      supportingChapters: [
        {
          courseId: "course-1",
          chapterKey: "chapter-1",
          chapterIndex: 1,
          title: "产品判断",
        },
      ],
      progressionRoles: [
        {
          id: "ai-product-lead",
          title: "AI 产品系统负责人",
          summary: "负责把 AI 能力拆成产品系统、指标和落地节奏。",
          horizon: "next",
          confidence: 0.86,
          supportingNodeRefs: ["node-product-judgement"],
        },
        {
          id: "agent-product-architect",
          title: "Agent 产品架构师",
          summary: "负责把多工具、多步骤 agent 能力组织成可运营产品。",
          horizon: "later",
          confidence: 0.78,
          supportingNodeRefs: ["node-agent-workflow"],
        },
      ],
      tree: [
        node("node-product-judgement", "AI 产品判断", [
          node("node-agent-workflow", "Agent 工作流设计"),
        ]),
      ],
    },
    {
      directionKey: "ai-research-engineering",
      title: "AI 研究工程师",
      summary: "偏算法实验、评测和模型改进的备选路线。",
      confidence: 0.66,
      whyThisDirection: "存在少量模型评测和实验方法证据。",
      supportingCourses: [{ courseId: "course-2", title: "模型评测基础" }],
      supportingChapters: [
        {
          courseId: "course-2",
          chapterKey: "chapter-1",
          chapterIndex: 1,
          title: "评测方法",
        },
      ],
      progressionRoles: [],
      tree: [node("node-evaluation", "模型评测")],
    },
  ],
};

const candidateFallbackSnapshot: CareerTreeSnapshot = {
  schemaVersion: CAREER_TREE_SCHEMA_VERSION,
  status: "ready",
  recommendedDirectionKey: "ai-product-systems",
  selectedDirectionKey: "ai-product-systems",
  generatedAt,
  trees: [
    {
      directionKey: "ai-product-systems",
      title: "AI 产品系统设计",
      summary: "当前树尚未形成稳定 progressionRoles。",
      confidence: 0.76,
      whyThisDirection: "课程证据集中但未来职业节点还不够稳定。",
      supportingCourses: [{ courseId: "course-1", title: "AI 产品系统课" }],
      supportingChapters: [
        {
          courseId: "course-1",
          chapterKey: "chapter-1",
          chapterIndex: 1,
          title: "产品判断",
        },
      ],
      progressionRoles: [],
      tree: [node("node-product-judgement", "AI 产品判断")],
    },
    {
      directionKey: "ai-market-strategy",
      title: "AI 增长策略师",
      summary: "以增长实验、内容系统和自动化运营作为可发展方向。",
      confidence: 0.7,
      whyThisDirection: "存在增长实验和内容系统证据。",
      supportingCourses: [{ courseId: "course-3", title: "AI 增长自动化" }],
      supportingChapters: [
        {
          courseId: "course-3",
          chapterKey: "chapter-2",
          chapterIndex: 2,
          title: "增长实验",
        },
      ],
      progressionRoles: [],
      tree: [node("node-market-loop", "增长实验设计")],
    },
  ],
};

const selectedTreeSnapshot: CareerTreeSnapshot = {
  ...candidateFallbackSnapshot,
  recommendedDirectionKey: "ai-product-systems",
  selectedDirectionKey: "ai-market-strategy",
};

export const careerTreeEvalSuite = createEvalSuite<CareerTreeEvalInput>({
  domain: "career-tree",
  version: "v1",
  cases: [
    {
      id: "career-tree-progression-roles-before-candidates",
      title: "当前树存在 progressionRoles 时，未来职业节点不能退回其它候选树",
      domain: "career-tree",
      promptVersion: "career-tree-graph@v1",
      input: {
        snapshot: progressionPreferredSnapshot,
        directionKey: "ai-product-systems",
        expected: {
          currentCareerKey: "ai-product-systems",
          expectedFutureCount: 2,
          futureSources: ["progression_role", "progression_role"],
          requiredFutureTitles: ["AI 产品系统负责人", "Agent 产品架构师"],
          forbiddenFutureTitles: ["AI 研究工程师"],
        },
      },
      expectations: ["progressionRoles 是当前树内部职业进阶，优先级高于其它 candidate tree"],
      tags: ["career-tree", "progression"],
    },
    {
      id: "career-tree-candidates-as-fallback",
      title: "当前树没有 progressionRoles 时，其它候选树才作为可发展方向",
      domain: "career-tree",
      promptVersion: "career-tree-graph@v1",
      input: {
        snapshot: candidateFallbackSnapshot,
        directionKey: "ai-product-systems",
        expected: {
          currentCareerKey: "ai-product-systems",
          expectedFutureCount: 1,
          futureSources: ["candidate_tree"],
          requiredFutureTitles: ["AI 增长策略师"],
        },
      },
      expectations: ["候选树是 fallback，不是 progressionRoles 的替代品"],
      tags: ["career-tree", "fallback"],
    },
    {
      id: "career-tree-selected-direction-is-current",
      title: "用户手动选择的方向应成为当前职业树",
      domain: "career-tree",
      promptVersion: "career-tree-graph@v1",
      input: {
        snapshot: selectedTreeSnapshot,
        expected: {
          currentCareerKey: "ai-market-strategy",
          expectedFutureCount: 1,
          futureSources: ["candidate_tree"],
          requiredFutureTitles: ["AI 产品系统设计"],
        },
      },
      expectations: ["用户选择不覆盖 AI 推荐字段，但会决定当前展示树"],
      tags: ["career-tree", "preference"],
    },
  ],
});

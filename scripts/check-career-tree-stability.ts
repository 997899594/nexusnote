import { resolveDirectionKeys } from "@/lib/career-tree/compose";
import { retrieveMergeCandidateSet } from "@/lib/career-tree/retrieve-merge-candidates";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function checkDirectionKeyStability() {
  const resolved = resolveDirectionKeys({
    trees: [
      {
        keySeed: "frontend-engineer",
        title: "前端工程",
        summary: "构建交互界面",
        confidence: 0.9,
        whyThisDirection: "已有足够 UI 证据",
        supportingNodeRefs: ["node-ui", "node-state", "node-react"],
        tree: [],
      },
      {
        keySeed: "data-engineer",
        title: "数据工程",
        summary: "组织数据流",
        confidence: 0.7,
        whyThisDirection: "数据建模信号开始出现",
        supportingNodeRefs: ["node-sql", "node-pipeline"],
        tree: [],
      },
    ],
    previousDirections: [
      {
        directionKey: "frontend-core",
        supportingNodeRefs: ["node-react", "node-ui", "node-state"],
      },
    ],
  });

  assert(resolved[0]?.directionKey === "frontend-core", "expected overlapping tree to inherit key");
  assert(resolved[1]?.directionKey === "data-engineer", "expected new tree to use keySeed slug");
}

function checkCandidateRetrieval() {
  const candidateSet = retrieveMergeCandidateSet({
    evidenceItems: [
      {
        title: "React state management",
        kind: "skill",
        summary: "管理组件状态与副作用",
        confidence: 0.9,
        chapterKeys: ["chapter-1"],
        prerequisiteHints: [],
        relatedHints: [],
        evidenceSnippets: ["状态管理", "副作用控制", "React 组件"],
      },
    ],
    existingNodes: [
      {
        id: "node-react",
        canonicalLabel: "React state architecture",
        summary: "组件状态、副作用与交互管理",
      },
      {
        id: "node-sql",
        canonicalLabel: "SQL querying",
        summary: "关系型查询与索引设计",
      },
    ],
    existingEvidenceLinks: [
      {
        nodeId: "node-react",
        title: "React rendering flow",
        summary: "组件状态更新机制",
      },
      {
        nodeId: "node-sql",
        title: "SQL basics",
        summary: "基础查询语法",
      },
    ],
    existingPrerequisiteEdges: [],
  });

  assert(candidateSet.nodes.length === 1, "expected one merge candidate node");
  assert(
    candidateSet.nodes[0]?.id === "node-react",
    "expected lexical retrieval to pick react node",
  );
}

function main() {
  checkDirectionKeyStability();
  checkCandidateRetrieval();
  console.log("[CareerTreeCheck] stable");
}

main();

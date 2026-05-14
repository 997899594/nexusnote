import { createEvalSuite } from "../runner";

export const growthEvalSuite = createEvalSuite({
  domain: "growth",
  version: "v1",
  cases: [
    {
      id: "growth-compose-strong-signal-frontend",
      title: "强信号用户应生成多棵有区分度的职业树",
      domain: "growth",
      promptVersion: "growth-compose@v15",
      input: {
        graph: {
          nodes: [
            {
              id: "node-react-foundations",
              canonicalLabel: "React Foundations",
              summary: "组件和 hooks 基础稳定。",
              progress: 82,
              state: "mastered",
              courseCount: 2,
              chapterCount: 6,
              evidenceScore: 84,
            },
            {
              id: "node-react-state",
              canonicalLabel: "React State Management",
              summary: "能处理状态和 Context。",
              progress: 71,
              state: "in_progress",
              courseCount: 2,
              chapterCount: 4,
              evidenceScore: 70,
            },
            {
              id: "node-typescript-ui",
              canonicalLabel: "TypeScript for UI",
              summary: "能约束组件接口。",
              progress: 66,
              state: "in_progress",
              courseCount: 2,
              chapterCount: 3,
              evidenceScore: 65,
            },
            {
              id: "node-nextjs-app-router",
              canonicalLabel: "Next.js App Router",
              summary: "接触过路由和服务端组件。",
              progress: 61,
              state: "in_progress",
              courseCount: 1,
              chapterCount: 3,
              evidenceScore: 58,
            },
            {
              id: "node-api-integration",
              canonicalLabel: "Frontend API Integration",
              summary: "会做接口调用。",
              progress: 49,
              state: "in_progress",
              courseCount: 1,
              chapterCount: 2,
              evidenceScore: 47,
            },
          ],
          prerequisiteEdges: [
            { from: "node-react-foundations", to: "node-react-state", confidence: 0.92 },
            { from: "node-react-state", to: "node-nextjs-app-router", confidence: 0.84 },
            { from: "node-typescript-ui", to: "node-nextjs-app-router", confidence: 0.81 },
          ],
        },
        preference: {
          selectedDirectionKey: "frontend-engineer",
          preferenceVersion: 3,
          selectionCount: 5,
          directionSignals: [
            {
              directionKey: "frontend-engineer",
              selectionCount: 4,
              latestSelectedAt: "2026-04-15T10:00:00.000Z",
            },
            {
              directionKey: "fullstack-web",
              selectionCount: 1,
              latestSelectedAt: "2026-04-10T10:00:00.000Z",
            },
          ],
        },
        previousSummary: {
          trees: [
            {
              directionKey: "frontend-engineer",
              supportingNodeRefs: [
                "node-react-foundations",
                "node-react-state",
                "node-nextjs-app-router",
              ],
            },
            {
              directionKey: "fullstack-web",
              supportingNodeRefs: ["node-api-integration", "node-nextjs-app-router"],
            },
          ],
        },
        expectedMinTrees: 2,
        expectedMaxTrees: 5,
      },
      expectations: [
        "输出应基于前端与 React/Next.js 强信号生成多棵候选职业树，而不是只给一棵泛化路线",
        "推荐方向应和已有高进度节点相匹配，并且候选树之间要有明确区分度",
        "树结构必须围绕输入隐藏能力图里的真实节点组织，不能脱离已有能力证据胡乱命名",
      ],
      tags: ["growth", "strong-signal", "multi-tree"],
    },
    {
      id: "growth-compose-weak-signal-conservative",
      title: "弱信号用户应保守生成少量高置信方向",
      domain: "growth",
      promptVersion: "growth-compose@v15",
      input: {
        graph: {
          nodes: [
            {
              id: "node-llm-basics",
              canonicalLabel: "LLM Basics",
              summary: "刚接触 prompt 基础。",
              progress: 31,
              state: "in_progress",
              courseCount: 1,
              chapterCount: 2,
              evidenceScore: 34,
            },
            {
              id: "node-prompt-iteration",
              canonicalLabel: "Prompt Iteration",
              summary: "会做简单迭代。",
              progress: 24,
              state: "ready",
              courseCount: 1,
              chapterCount: 1,
              evidenceScore: 22,
            },
          ],
          prerequisiteEdges: [
            { from: "node-llm-basics", to: "node-prompt-iteration", confidence: 0.72 },
          ],
        },
        preference: {
          selectedDirectionKey: null,
          preferenceVersion: 0,
        },
        previousSummary: null,
        expectedMinTrees: 1,
        expectedMaxTrees: 2,
      },
      expectations: [
        "输出应表现为保守收敛的少量方向，不应硬凑出很多职业树",
        "方向命名应贴近当前 AI 入门能力信号，而不是夸大成成熟职业画像",
        "推荐方向和树枝都要保持 grounded，围绕已有能力节点组织",
      ],
      tags: ["growth", "weak-signal", "conservative"],
    },
  ],
});

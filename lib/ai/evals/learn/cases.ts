import { createEvalSuite } from "../runner";

export const learnEvalSuite = createEvalSuite({
  domain: "learn",
  version: "v2",
  cases: [
    {
      id: "learn-react-useeffect-explainer",
      title: "围绕课程上下文解释 useEffect",
      domain: "learn",
      promptVersion: "learn-assist@v1",
      input: {
        question: "这一节里的 useEffect 和普通函数调用到底差在哪？",
        courseContext: "React 入门，第 3 章副作用与生命周期，本节：useEffect 的执行时机与依赖数组",
      },
      expectations: [
        "优先引用当前课程上下文而不是泛泛定义",
        "回答应解释副作用触发时机和依赖数组",
        "回答应围绕当前小节主题展开，不要编造与本节无关的课程细节",
      ],
      regression: {
        minOutputLength: 60,
        requiredSubstrings: ["useEffect", "依赖"],
        forbiddenSubstrings: ["tool-", "data-", "Redux"],
        forbiddenPatterns: ['"type"\\s*:'],
      },
      tags: ["grounding", "course-context"],
    },
    {
      id: "learn-algorithm-complexity-followup",
      title: "算法复杂度追问",
      domain: "learn",
      promptVersion: "learn-assist@v1",
      input: {
        question: "为什么这里的时间复杂度是 O(n log n)，不是 O(n^2)？",
        courseContext: "算法导论，第 2 章分治排序，本节：归并排序的递归树与复杂度推导",
      },
      expectations: [
        "回答要解释复杂度来源，而不是只报结论",
        "优先结合课程中的排序过程作答",
        "不要脱离当前章节讨论其他无关算法",
      ],
      regression: {
        minOutputLength: 50,
        requiredSubstrings: ["递归树", "分治"],
        forbiddenSubstrings: ["tool-", "data-", "动态规划"],
        forbiddenPatterns: ['"type"\\s*:'],
      },
      tags: ["reasoning", "grounding"],
    },
    {
      id: "learn-context-boundary-should-stay-on-chapter",
      title: "学习助理应围绕当前章节，不乱跳主题",
      domain: "learn",
      promptVersion: "learn-assist@v1",
      input: {
        question: "这一节先学 Context API 还是 Redux 更合适？",
        courseContext:
          "React 进阶，第 4 章状态共享与 Context API，本节：Context Provider 与 useContext",
      },
      expectations: [
        "应优先围绕当前章节里的 Context API 作答",
        "如果提到 Redux，应作为对比而不是把回答重心带偏",
        "回答应帮助用户理解当前章节的学习顺序",
      ],
      regression: {
        minOutputLength: 50,
        requiredSubstrings: ["Context"],
        forbiddenSubstrings: ["tool-", "data-", "MobX"],
        forbiddenPatterns: ['"type"\\s*:'],
      },
      tags: ["grounding", "scope-control"],
    },
    {
      id: "learn-should-ask-for-missing-code-context",
      title: "缺少代码细节时应先限定判断边界",
      domain: "learn",
      promptVersion: "learn-assist@v1",
      input: {
        question: "这里这个类型错误为什么会出现？",
        courseContext: "TypeScript 进阶，第 5 章泛型约束",
      },
      expectations: [
        "在没有具体代码和报错内容时，不应假装知道唯一原因",
        "回答应先给出泛型约束相关的常见原因，再请求补充代码或报错片段",
        "语境仍应围绕当前课程章节，而不是跳到无关 TS 话题",
      ],
      regression: {
        minOutputLength: 50,
        requiredSubstrings: ["泛型", "代码"],
        forbiddenSubstrings: ["tool-", "data-", "Vue"],
        forbiddenPatterns: ['"type"\\s*:'],
      },
      tags: ["grounding", "clarification"],
    },
  ],
});

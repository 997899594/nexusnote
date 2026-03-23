import { createEvalSuite } from "../runner";

export const learnEvalSuite = createEvalSuite({
  domain: "learn",
  version: "v1",
  cases: [
    {
      id: "learn-react-useeffect-explainer",
      title: "围绕课程上下文解释 useEffect",
      domain: "learn",
      promptVersion: "learn-assist@v1",
      input: {
        question: "这一节里的 useEffect 和普通函数调用到底差在哪？",
        courseContext: "React 入门，第 3 章副作用与生命周期",
      },
      expectations: [
        "优先引用当前课程上下文而不是泛泛定义",
        "回答应解释副作用触发时机和依赖数组",
        "如果上下文不足，应先请求 loadLearnContext",
      ],
      tags: ["grounding", "course-context"],
    },
    {
      id: "learn-algorithm-complexity-followup",
      title: "算法复杂度追问",
      domain: "learn",
      promptVersion: "learn-assist@v1",
      input: {
        question: "为什么这里的时间复杂度是 O(n log n)，不是 O(n^2)？",
        courseContext: "算法导论，第 2 章分治排序",
      },
      expectations: [
        "回答要解释复杂度来源，而不是只报结论",
        "优先结合课程中的排序过程作答",
        "不要脱离当前章节讨论其他无关算法",
      ],
      tags: ["reasoning", "grounding"],
    },
  ],
});

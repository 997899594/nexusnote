import { createEvalSuite } from "../runner";

export const interviewEvalSuite = createEvalSuite({
  domain: "interview",
  version: "v1",
  cases: [
    {
      id: "interview-frontend-react-roadmap",
      title: "前端转 React 课程访谈",
      domain: "interview",
      promptVersion: "interview@v1",
      input: {
        userGoal: "我会 HTML/CSS/JS，想系统学 React 并做一个作品集项目。",
      },
      expectations: [
        "先澄清学习目标、基础水平和时间约束",
        "最终 outline 应覆盖 React 基础、状态管理、路由、实战项目",
        "不应直接跳到泛泛而谈的职业建议",
      ],
      tags: ["outline-quality", "goal-clarity"],
    },
    {
      id: "interview-data-analyst-sql-python",
      title: "数据分析转型课程访谈",
      domain: "interview",
      promptVersion: "interview@v1",
      input: {
        userGoal: "我想从运营转数据分析，重点补 SQL、Python 和可视化。",
      },
      expectations: [
        "访谈中应确认业务背景和目标岗位",
        "outline 需要区分 SQL、Python、分析方法、可视化四层结构",
        "不要在未确认需求前直接创建课程",
      ],
      tags: ["discovery", "curriculum-structure"],
    },
  ],
});

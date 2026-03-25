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
    {
      id: "interview-revise-outline-practical-focus",
      title: "已有大纲后增强实战导向",
      domain: "interview",
      promptVersion: "interview@v1",
      input: {
        userGoal: "这个大纲不错，但我想减少理论，增加一个从零做数据分析作品集的实战项目。",
        currentOutline: {
          title: "运营转数据分析课程",
          description: "帮助运营背景学习者补齐数据分析能力，完成转岗准备。",
          targetAudience: "希望从运营转向数据分析岗位的学习者",
          estimatedHours: 24,
          difficulty: "beginner",
          learningOutcome: "能独立完成基础数据分析项目并准备转岗作品集。",
          chapters: [
            {
              title: "SQL 基础",
              description: "掌握常见查询与数据处理。",
              sections: [
                { title: "查询语句", description: "理解 select、where、group by。" },
                { title: "表连接", description: "掌握 join 与多表分析。" },
              ],
            },
            {
              title: "Python 分析",
              description: "用 Python 处理和分析业务数据。",
              sections: [
                { title: "Pandas 入门", description: "完成清洗和聚合。" },
                { title: "图表表达", description: "输出基础可视化结果。" },
              ],
            },
          ],
        },
      },
      expectations: [
        "应优先理解修改意图，而不是重新从头询问目标和基础",
        "返回的 outline 需要保留原方向，同时增强实战项目部分",
        "options 应更像修改动作，而不是回到初始访谈选项",
      ],
      tags: ["revise", "outline-adjustment"],
    },
  ],
});

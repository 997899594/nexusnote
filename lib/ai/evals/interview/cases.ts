import { createEvalSuite } from "../runner";

export const interviewEvalSuite = createEvalSuite({
  domain: "interview",
  version: "v3",
  cases: [
    {
      id: "interview-natural-frontend-react-roadmap",
      title: "自然访谈下的 React 课程访谈",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
        mode: "natural",
        userGoal: "我会 HTML/CSS/JS，想系统学 React 并做一个作品集项目。",
      },
      expectations: [
        "可以直接给出课程草案，或只补一个真正影响课程设计的关键约束；不要重复确认已知主题、基础或作品集目标",
        "最终 outline 应覆盖 React 基础、状态管理、路由、实战项目",
        "不应直接跳到泛泛而谈的职业建议",
      ],
      tags: ["outline-quality", "goal-clarity", "natural"],
    },
    {
      id: "interview-structured-data-analyst-sql-python",
      title: "结构化访谈下的数据分析转型课程",
      domain: "interview",
      promptVersion: "interview@structured-v2",
      input: {
        mode: "structured",
        userGoal: "我想从运营转数据分析，重点补 SQL、Python 和可视化。",
      },
      expectations: [
        "在信息还不够时，可以继续澄清；澄清应优先围绕当前最缺的一维，不要一次追问多个维度",
        "不应先退回到技术关键词驱动的默认追问，而要围绕主题、目标结果、当前基础、关键约束来收敛",
        "如果直接给出 outline，应能区分 SQL、Python、分析方法、可视化四层",
      ],
      tags: ["discovery", "curriculum-structure", "structured"],
    },
    {
      id: "interview-structured-revise-outline-practical-focus",
      title: "结构化访谈下的已有大纲增强实战导向",
      domain: "interview",
      promptVersion: "interview@structured-v2",
      input: {
        mode: "structured",
        userGoal: "这个大纲不错，但我想减少理论，增加一个从零做数据分析作品集的实战项目。",
        currentOutline: {
          title: "运营转数据分析课程",
          description: "帮助运营背景学习者补齐数据分析能力，完成转岗准备。",
          targetAudience: "希望从运营转向数据分析岗位的学习者",
          difficulty: "beginner",
          learningOutcome: "能独立完成基础数据分析项目并准备转岗作品集。",
          chapters: [
            {
              title: "SQL 基础",
              description: "掌握常见查询与数据处理。",
              sections: [
                { title: "查询语句", description: "理解 select、where、group by。" },
                { title: "表连接", description: "掌握 join 与多表分析。" },
                { title: "聚合分析", description: "用统计指标读取业务变化。" },
                { title: "常见分析题", description: "练习转岗面试里的 SQL 问题。" },
              ],
            },
            {
              title: "Python 分析",
              description: "用 Python 处理和分析业务数据。",
              sections: [
                { title: "Pandas 入门", description: "完成清洗和聚合。" },
                { title: "图表表达", description: "输出基础可视化结果。" },
                { title: "数据清洗流程", description: "处理空值、异常值和字段转换。" },
                { title: "分析报告输出", description: "整理成可交付的分析结论。" },
              ],
            },
            {
              title: "指标体系与业务分析",
              description: "从运营视角理解关键指标与分析框架。",
              sections: [
                { title: "核心指标拆解", description: "理解转化、留存与复购指标。" },
                { title: "漏斗与用户旅程", description: "定位问题环节和优化机会。" },
                { title: "活动复盘方法", description: "评估活动效果并沉淀结论。" },
                { title: "业务问题建模", description: "把业务问题转成分析问题。" },
              ],
            },
            {
              title: "可视化与沟通",
              description: "把数据洞察表达给业务与团队。",
              sections: [
                { title: "图表选型原则", description: "根据问题选择合适图表。" },
                { title: "故事化表达", description: "让分析结果更容易被理解。" },
                { title: "仪表盘基础", description: "构建可复用的数据看板。" },
                { title: "汇报结构设计", description: "形成业务听得懂的结论表达。" },
              ],
            },
            {
              title: "作品集项目",
              description: "把前面能力整合成可展示的实战项目。",
              sections: [
                { title: "项目选题", description: "选择适合转岗展示的项目主题。" },
                { title: "数据获取与整理", description: "搭建项目数据基础。" },
                { title: "完整分析流程", description: "完成从问题到结论的项目闭环。" },
                { title: "作品集包装", description: "把项目整理成求职展示材料。" },
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
      tags: ["revise", "outline-adjustment", "structured"],
    },
    {
      id: "interview-structured-ppt-work-report",
      title: "结构化访谈下的非技术 PPT 课程",
      domain: "interview",
      promptVersion: "interview@structured-v2",
      input: {
        mode: "structured",
        userGoal: "我想学做 PPT，两周后能独立完成工作汇报，目前基本零基础。",
      },
      expectations: [
        "不应把用户拉回技术课程语境",
        "可以直接给出课程草案，或者只补一个真正关键的使用约束",
        "如果给出 outline，应围绕汇报目标、结构表达、视觉呈现、实战演练展开",
      ],
      tags: ["all-domain", "non-technical", "structured"],
    },
    {
      id: "interview-natural-vague-goal-should-keep-discovering",
      title: "自然访谈下目标模糊时应继续追问",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
        mode: "natural",
        userGoal: "我想学 AI，但还没想好具体方向。",
      },
      expectations: [
        "应先澄清具体方向、背景或使用场景，而不是直接给课程大纲",
        "返回应包含可执行的下一步选项，帮助用户缩小范围",
        "问题应聚焦，不要一次性发散到太多维度",
      ],
      tags: ["discovery", "guardrail", "natural"],
    },
  ],
});

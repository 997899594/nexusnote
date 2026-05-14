import { createEvalSuite } from "../runner";

export const interviewEvalSuite = createEvalSuite({
  domain: "interview",
  version: "v3",
  cases: [
    {
      id: "interview-natural-assistant-meta-text-only",
      title: "自然访谈下用户询问助手身份时应直接回答",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
        userGoal: "你是谁",
        expectedInteraction: "text",
      },
      expectations: [
        "应直接说明自己是 NexusNote 的课程访谈或课程规划助手",
        "不应强行展示选项或课程大纲",
        "不应假装用户已经提供了学习目标，也不应自行推进到课程生成",
      ],
      tags: ["natural", "assistant-meta", "text-only"],
    },
    {
      id: "interview-natural-meta-followup-asks-open-topic",
      title: "自然访谈下用户说问吧时不应从画像猜主题",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
        userGoal: "问吧",
        messages: [
          {
            role: "user",
            text: "你是谁",
          },
          {
            role: "assistant",
            text: "我是 NexusNote 的课程访谈助手，帮你把想学的内容整理成可确认的课程蓝图。如果你愿意，我可以继续问一个关键问题，帮你更快收敛方向。",
          },
          {
            role: "user",
            text: "问吧",
          },
        ],
      },
      expectations: [
        "应询问用户想学什么、希望达到什么结果或当前基础，而不是擅自选择某个具体领域",
        "不应根据画像或历史成长方向默认用户要继续学 React、前端或任何特定主题",
        "可以给全领域的方向选项，但必须保持开放，让用户自己选择主方向",
      ],
      regression: {
        forbiddenSubstrings: ["React", "前端"],
      },
      tags: ["natural", "assistant-meta", "topic-authority"],
    },
    {
      id: "interview-natural-frontend-react-roadmap",
      title: "自然访谈下的 React 课程访谈",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
        userGoal: "我会 HTML/CSS/JS，想系统学 React 并做一个作品集项目。",
      },
      expectations: [
        "可以直接给出课程蓝图，或只补一个真正影响课程设计的关键约束；不要重复确认已知主题、基础或作品集目标",
        "最终 outline 应覆盖 React 基础、状态管理、路由、实战项目",
        "不应直接跳到泛泛而谈的职业建议",
      ],
      tags: ["outline-quality", "goal-clarity", "natural"],
    },
    {
      id: "interview-natural-data-analyst-sql-python",
      title: "自然访谈下的数据分析转型课程",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
        userGoal: "我想从运营转数据分析，重点补 SQL、Python 和可视化。",
      },
      expectations: [
        "在信息还不够时，可以继续澄清；澄清应优先围绕当前最缺的一维，不要一次追问多个维度",
        "不应先退回到技术关键词驱动的默认追问，而要围绕主题、目标结果、当前基础、关键约束来收敛",
        "如果直接给出 outline，应能区分 SQL、Python、分析方法、可视化四层",
      ],
      tags: ["discovery", "curriculum-structure", "natural"],
    },
    {
      id: "interview-natural-revise-outline-practical-focus",
      title: "自然访谈下的已有大纲增强实战导向",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
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
      tags: ["revise", "outline-adjustment", "natural"],
    },
    {
      id: "interview-natural-ppt-work-report",
      title: "自然访谈下的非技术 PPT 课程",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
        userGoal: "我想学做 PPT，两周后能独立完成工作汇报，目前基本零基础。",
      },
      expectations: [
        "不应把用户拉回技术课程语境",
        "可以直接给出课程蓝图，或者只补一个真正关键的使用约束",
        "如果给出 outline，应围绕汇报目标、结构表达、视觉呈现、实战演练展开",
      ],
      tags: ["all-domain", "non-technical", "natural"],
    },
    {
      id: "interview-natural-revise-add-western-cuisine-chapter",
      title: "自然访谈下已有 7 章大纲继续新增西餐章节",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
        userGoal: "你这个大纲里加一章西餐就行",
        currentOutline: {
          title: "家常菜从零入门",
          description: "帮助零基础学习者掌握家常菜基础流程。",
          targetAudience: "没有系统下厨经验的学习者",
          difficulty: "beginner",
          learningOutcome: "能独立完成常见家常菜，并理解基本调味和火候。",
          chapters: [
            {
              title: "厨房基础与安全",
              sections: [{ title: "工具认识" }, { title: "安全习惯" }, { title: "备菜流程" }],
            },
            {
              title: "刀工与食材处理",
              sections: [{ title: "基础刀法" }, { title: "肉类处理" }, { title: "蔬菜处理" }],
            },
            {
              title: "调味基础",
              sections: [{ title: "咸鲜平衡" }, { title: "酸甜苦辣" }, { title: "复合调味" }],
            },
            {
              title: "炒菜火候入门",
              sections: [{ title: "热锅冷油" }, { title: "快炒逻辑" }, { title: "出锅判断" }],
            },
            {
              title: "炖煮与汤菜",
              sections: [{ title: "焯水去腥" }, { title: "慢炖入味" }, { title: "收汁判断" }],
            },
            {
              title: "家常小炒进阶",
              sections: [{ title: "荤素搭配" }, { title: "一菜两吃" }, { title: "剩菜再利用" }],
            },
            {
              title: "复盘与菜单规划",
              sections: [{ title: "失败复盘" }, { title: "口味记录" }, { title: "一周菜单" }],
            },
          ],
          courseSkillIds: ["家常菜", "食材处理", "调味", "火候"],
        },
      },
      expectations: [
        "必须优先理解为修改已有大纲，而不是重新追问西餐细节",
        "返回的大纲应真实新增西餐相关章节，章节数量应从 7 增加到 8",
        "新增章节应包含意面、煎烤、沙拉或酱汁等西餐入门内容中的至少一类",
      ],
      tags: ["revise", "outline-adjustment", "natural", "all-domain"],
    },
    {
      id: "interview-natural-vague-goal-should-keep-discovering",
      title: "自然访谈下目标模糊时应继续追问",
      domain: "interview",
      promptVersion: "interview@natural-v2",
      input: {
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

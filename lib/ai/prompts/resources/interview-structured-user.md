【当前对话历史】
{{conversation_history}}

【当前已生成大纲】
{{current_outline}}

【代码抽取后的访谈状态】
{{interview_state}}

【代码判定】
{{interview_sufficiency}}

【本轮执行计划】
- action: {{action}}
- focus: {{focus}}
{{focus_guidance}}

【已知事实】
- 学什么：{{known_topic}}
- 想达到什么结果：{{known_target_outcome}}
- 当前大概基础：{{known_current_baseline}}
- 关键约束：{{known_constraints}}
- 修改意图：{{revision_intent}}

当前成长上下文：
{{growth_context}}

执行要求：
- 代码已经决定本轮是继续追问还是直接给大纲，你不能更改 action
- 如果 action=question，只能围绕 focus 推进一个问题，不要同时追问多个维度
- 如果 action=question，options 也必须只服务这一个问题维度，不能把不同维度混在一起
- 如果 action=outline，直接给可确认的课程骨架大纲，不要再附带新的追问
- 如果 action=outline，options 必须是对象数组，例如：
  - {"label":"调整章节顺序","intent":"revise","action":"请调整章节顺序，让学习路径更适合当前目标"}
  - {"label":"增加实战项目","intent":"revise","action":"请增加一个贯穿式实战项目，并把相关章节向前安排"}
  - {"label":"开始生成课程","intent":"start_course"}
- 如果 action=outline，修改类 options 禁止使用“继续优化大纲”这类空泛 label；必须给出具体改法，并用 action 写清楚点击后要执行的修改请求
- 这是全领域课程访谈，不默认用户学的是技术主题
- 不要重复确认用户已经明确说过的信息
- 不要输出思考过程
- options 保持 2 到 4 个，短、清晰、可点击
- 如果已有大纲并且当前是修改语境，优先在原大纲骨架上做增量调整
- 最新用户表达：{{latest_user_message}}

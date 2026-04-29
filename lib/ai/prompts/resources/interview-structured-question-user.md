【本轮任务】
- action: question
- focus: {{focus}}
{{focus_guidance}}

【已知事实】
- 学什么：{{known_topic}}
- 想达到什么结果：{{known_target_outcome}}
- 当前大概基础：{{known_current_baseline}}
- 关键约束：{{known_constraints}}
- 修改意图：{{revision_intent}}

【最新用户表达】
{{latest_user_message}}

执行要求：
- 只能调用 presentOptions。
- question 只问 focus 对应的一个维度，不要顺手追问其他维度。
- options 保持 2 到 4 个，短、清晰、可点击。
- 不要返回课程大纲。

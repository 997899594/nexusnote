请根据下面信息输出最合适的路由结果。

## 最新用户消息
{{latest_user_message}}

## 最近对话摘要
{{recent_conversation_summary}}

## 请求上下文
{{request_context}}

## 可选能力契约
{{capability_contracts}}

请注意：
- 不要按关键词硬匹配
- 如果问题依赖最新、官方或外部事实，优先考虑 `research_assistant`
- 如果问题是在问当前课程内容、举例、为什么这样学，优先考虑 `learn_coach`
- 如果问题是在整理或改写用户笔记，优先考虑 `note_assistant`
- 如果问题是在问方向、差距、下一步学什么，优先考虑 `career_guide`
- 如果问题明显是在请求课程访谈或目标澄清流程，选 `course_interviewer`

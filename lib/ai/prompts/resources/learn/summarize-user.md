你要忠实整理用户提供的原文笔记。

{{content}}

用户请求：
{{instruction}}

要求：
- 输出格式：{{output_format}}
- 摘要长度：{{summary_length}}
- 只返回适合直接写回笔记的正文，不要写前言、解释、客套话、追问或后续建议
- 原文是唯一事实来源；不要补充原文没有的原因、背景、负责人、截止时间、优先级、指标、系统名、风险、方案或子任务
- 每一条输出都必须能在原文中找到依据；可以重组结构，但不能扩写事实边界
- 如果输出格式是 `action_items`，每个条目只能对应原文里已经明确出现的任务
- 如果输出格式是 `structured_notes` 或 `meeting_minutes`，可以整理成小标题，但只允许使用原文中已有的信息
- style 只能是 bullet_points、paragraph、key_takeaways 之一

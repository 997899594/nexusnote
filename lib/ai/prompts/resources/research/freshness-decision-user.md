请判断下面课程访谈或课程小节是否需要先进行外部检索/研究。

## 当前日期
{{current_date}}

## 最近用户消息
{{recent_user_messages}}

## 当前种子消息
{{seed_message}}

## 最新用户消息
{{latest_user_message}}

## 代码策略已识别信号
- domain: {{policy_domain}}
- reasonCodes: {{policy_reason_codes}}
- ambiguousSignals: {{ambiguous_signals}}

这些代码信号只是候选线索，不是最终结论。你需要结合主题本身的信息鲜度、来源可验证性和课程正文风险，输出最终结构化计划。

输出要求：
- requiresResearch: 是否必须先检索外部资料
- domain: 从 ai_frontier / current_technology / product_ecosystem / general_current 中选择
- reasonCodes: 从 freshness_cue / recent_year / ai_frontier_domain / technology_domain / product_competitor_domain / market_ecosystem_domain 中选择 1-4 个
- freshnessWindowDays: 30/90/180，越容易过时越短
- freshnessProfile: stable/current/frontier
- retrievalMode: targeted/deep
- sourceTypes: official_docs / release_note / paper / source_code / technical_blog / news 中选择 1-6 个
- queryFocus: 一句话描述检索重点，便于形成高质量查询
- rationale: 一句话说明为什么这个主题需要或不需要资料校准

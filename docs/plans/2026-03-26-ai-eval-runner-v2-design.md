# AI Eval Runner V2 Design

## Goal

将当前的 AI eval 从“真实执行链 + AI judge”升级到更现代的组合方案：

1. 真实生产链执行
2. deterministic rule checks
3. runtime metrics
4. AI judge
5. per-case 实时输出

目标不是推翻现有 eval，而是在现有基础上补齐“可观测性”和“稳定性”。

## Current State

当前 runner 主要由以下文件组成：

- `/Users/findbiao/projects/nexusnote/lib/ai/evals/runner.ts`
- `/Users/findbiao/projects/nexusnote/lib/ai/evals/judge.ts`
- `/Users/findbiao/projects/nexusnote/lib/ai/evals/types.ts`
- `/Users/findbiao/projects/nexusnote/scripts/run-ai-evals.ts`

现有优点：

- 已经走真实生产链，尤其 `chat` / `interview` / `notes`
- 已有 AI judge，可以快速形成质量闭环
- case 定义清晰、扩展成本低

现有问题：

- bulk run 黑箱感很强，长时间无输出时难以判断卡点
- 没有 deterministic checks，全部质量几乎都交给 AI judge
- 没有统一 runtime metrics，像 `firstTextMs / firstOutlineMs` 还依赖临时脚本
- fail 时只看到最终失败，不知道是在生成、tool、stream 还是 judge 阶段卡住

## Design Principles

1. 不推翻现有 runner，只做增量升级
2. 继续跑真实生产链，不退回 mock 或 prompt-only
3. AI judge 保留，但不再作为唯一真理
4. deterministic checks 只做稳定、清晰、无争议的规则
5. runtime metrics 直接进入 eval 结果结构，避免散落在临时脚本
6. CLI 必须逐 case 输出，避免黑箱

## V2 Data Model

### Runtime Metrics

每条 case 新增：

- `totalMs`
- `firstTextMs`
- `firstOptionsMs`
- `firstOutlineMs`
- `timedOut`

不是每个 domain 都需要每个字段；无值时为 `null`。

### Rule Checks

每条 case 新增：

- `name`
- `passed`
- `details`

第一批先做 interview 的稳定规则：

- preview 阶段 `courseId` 必须为空
- 如果返回 outline，chapter count 必须在 `5-7`
- 如果返回 outline，每章 section count 必须在 `4-6`
- 如果返回 outline，必须带 title / description / targetAudience / learningOutcome
- assistant 必须返回 message
- assistant options 必须在 `2-4`

这些规则不依赖 judge，因此稳定、可回归。

### Final Verdict

每条 case 保留：

- `score`
- `passed`
- `notes`

但 `passed` 需要同时满足：

- `judgeScore >= 0.8`
- 所有 deterministic checks 通过

## Execution Flow

每条 case 的执行流程：

1. 输出 `START caseId`
2. 跑真实生成链
3. 记录 runtime metrics
4. 执行 deterministic checks
5. 调用 AI judge
6. 合并结果
7. 立刻输出该 case 的结果摘要

最终 suite 再输出汇总 JSON。

## Why This Is More Modern

这套方案比当前更现代的原因，不是因为模型更多，而是因为：

- 不再把评估完全交给 AI judge
- 延迟、结构完整性、协议约束都进入正式评估结果
- bulk runner 不再是黑箱
- 更接近真实 AI QA 平台的最小版本

## Scope For This Iteration

本轮只实现：

1. per-case 实时输出
2. runtime metrics 进入 eval 结果
3. interview deterministic checks

后续再做：

1. learn / notes / chat 的 deterministic checks
2. 细粒度 trace / replay
3. CI gate
4. judge 模型与被测模型进一步解耦

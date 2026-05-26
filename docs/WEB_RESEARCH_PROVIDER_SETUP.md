# Web Research Provider Setup

更新时间：2026-05-26

这份文档记录 NexusNote 联网 research 链路的五个外部 key：`TAVILY_API_KEY`、
`EXA_API_KEY`、`JINA_API_KEY`、`FIRECRAWL_API_KEY`、`DASHSCOPE_API_KEY`。

## 结论

当前方案只保留现代 research 主链路：

- Tavily：agent search + 批量页面抽取
- Exa：semantic / deep web search + highlights / contents
- Jina：AI-native search + Reader
- Firecrawl：复杂页面正文抽取
- DashScope：官方 Qwen3 reranker

已删除的低价值链路：

- Serper / Google fallback
- 302 gateway `/rerank` 兼容兜底

本项目的判断标准很明确：宁可缺 key 后显式跳过，也不维护低质量或过时兼容实现。

## 申请优先级

### 1. Tavily

环境变量：`TAVILY_API_KEY`

项目用途：

- 第一优先级搜索 provider
- 负责 `search_depth=advanced` 的 agent search
- 负责 Tavily Extract 批量读取关键 URL 正文
- 给前沿课程蓝图、research job、chat webSearch 提供主要来源

为什么优先：

- 对 agent/search 场景是专门设计的 API
- 同时覆盖 search 和 extract，少一个供应商也能跑出完整闭环
- 本项目的 `searchAcrossProviders` 和 `extractDocuments` 都把 Tavily 放在第一梯队

申请入口：

- API key: https://app.tavily.com/home
- 官方价格说明：https://docs.tavily.com/documentation/api-credits

费用口径：

- 官方文档显示每月有免费 API credits
- `basic` search 和 `advanced` search 消耗不同，当前项目用 `advanced`
- Tavily Extract 按成功抽取 URL 数和 extract depth 计费

申请步骤：

1. 打开 Tavily dashboard。
2. 登录或注册账号。
3. 进入 API Keys / Settings。
4. 创建新的 API key。
5. 复制 key，填入本地 `.env` 或 `.env.local`。

填法：

```env
TAVILY_API_KEY=tvly-...
```

成本控制：

- 不要把 `limit` 默认调得过高。
- 不要对同一 query 反复强刷，代码已有 Redis cache 和 freshness window。
- 复杂 research 使用 30/90/180 天 freshness window，避免无意义全网重查。

### 2. Exa

环境变量：`EXA_API_KEY`

项目用途：

- 第二优先级搜索 provider
- 负责 semantic / deep web search
- 获取 highlights 和部分正文内容
- 补足 Tavily 对技术文档、论文、repo、release note 的语义召回

为什么保留：

- Exa 是面向 AI 的搜索引擎，不是传统 SERP 包装
- 对代码、技术文档、论文、公司/人/事件类检索更适合
- 本项目使用 Exa 的 `search` endpoint，并启用 text/highlights contents

申请入口：

- API key: https://dashboard.exa.ai/api-keys
- 官方文档：https://exa.ai/docs/reference/getting-started
- 官方价格：https://exa.ai/pricing

费用口径：

- 官方价格页显示每月有免费请求额度
- Search、Deep Search、Contents、Agent 分别计价
- 当前项目使用 Search + contents/highlights，不使用 Exa Agent

Onboarding 页面怎么填：

```text
What are you coding with?
Codex

What integration should the prompt generate?
JavaScript

What are you building?
Web search tool
```

也可以直接点右上角 `Skip`，因为项目代码已经接好了 Exa，不需要它生成 setup prompt。

填法：

```env
EXA_API_KEY=...
```

成本控制：

- 不要默认改成 Exa Agent 或大量 Deep Search。
- 当前项目只把 Exa 作为并行检索源，不把它作为唯一来源。
- 结果会被 URL 去重、来源分级、reranker 重排，避免重复页面浪费后续抽取成本。

### 3. Jina

环境变量：`JINA_API_KEY`

项目用途：

- 第三优先级搜索 provider：`https://s.jina.ai`
- 页面读取兜底：`https://r.jina.ai`
- 当 Firecrawl 或 Tavily Extract 不适合某些页面时，Jina Reader 提供轻量正文抽取

为什么保留：

- Jina Reader / Search 是 AI grounding 场景的现代工具
- Reader 输出 LLM-friendly markdown/text，适合进入后续 evidence chunks
- Search 和 Reader 共用一个 key，配置成本低

申请入口：

- API key: https://jina.ai/api-dashboard/key-manager
- Reader / Search 说明：https://jina.ai/reader/

费用口径：

- 官方 Reader 页面说明基础 Reader 可免费使用，但 API key 提供更高 rate limit
- Jina API pricing 基于 token usage
- 新 API key 有免费 tokens，后续可 top-up
- `s.jina.ai` search 每次请求有固定起步 token 消耗

填法：

```env
JINA_API_KEY=jina_...
```

成本控制：

- Jina Search 适合作为并行补强，不要替代 Tavily + Exa。
- Jina Reader 放在 Firecrawl 之后作为轻量兜底。
- 不要默认开启 ReaderLM-v2 等高成本选项，除非后续代码明确按页面类型选择。

### 4. Firecrawl

环境变量：`FIRECRAWL_API_KEY`

项目用途：

- 第四优先级正文抽取 provider
- 负责复杂网页 scrape，输出 markdown
- 在 Tavily Extract 之后、Jina Reader 之前尝试读取页面正文

为什么保留：

- Firecrawl 对动态页面、复杂 HTML、主内容抽取更强
- 它不是搜索主链路，而是页面级读取工具
- 本项目只调用 `v2/scrape`，不默认使用 crawl、agent、interact 等高成本能力

申请入口：

- API key / dashboard: https://www.firecrawl.dev/app/api-keys
- API 文档：https://docs.firecrawl.dev/api-reference/introduction
- 官方价格：https://www.firecrawl.dev/pricing

费用口径：

- 官方价格页显示免费计划有每月 credits
- Scrape / Crawl / Map / Search / Interact 按不同规则消耗 credits
- 当前项目使用 Scrape，通常按页面消耗

填法：

```env
FIRECRAWL_API_KEY=fc-...
```

成本控制：

- 不要默认启用 crawl。
- 不要在 research 默认读取过多来源；当前 `maxExtractedSources` 会限制抽取数量。
- 对高频 query 依赖 Redis extract cache，避免重复 scrape 同一 URL。

### 5. DashScope

环境变量：`DASHSCOPE_API_KEY`

项目用途：

- Qwen3 reranker 官方调用凭证
- 只用于 research evidence chunks 的重排
- 提升引用来源排序质量，降低 SEO 页面和弱相关页面进入蓝图的概率

为什么保留：

- 这是 Qwen3 rerank 的官方链路
- 项目已删除 302 `/rerank` 兼容兜底，不再维护旧网关重排
- 没配置时显式跳过 reranker，并使用 lexical + quality score 排序

申请入口：

- API key 说明：https://www.alibabacloud.com/help/en/model-studio/get-api-key
- Model Studio console：https://modelstudio.console.alibabacloud.com/
- Qwen 模型和价格表：https://www.alibabacloud.com/help/en/model-studio/models

费用口径：

- 官方模型表列出 `qwen3-rerank` 的输入限制和按 1M input tokens 计价
- 当前项目默认模型：`qwen3-rerank`
- 只对候选 chunks 做 top-N 重排，不参与长文本生成

填法：

```env
DASHSCOPE_API_KEY=sk-...
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-api/v1
RERANKER_MODEL=qwen3-rerank
RERANKER_MODEL_PRO=qwen3-rerank
RERANKER_ENABLED=true
```

成本控制：

- 不要把 chunk 数无限放大。
- 当前代码会限制候选 chunk 和 `top_n`。
- 如果 key 暂时没有，也不要接旧兼容网关；允许 rerank 跳过。

## 本地填写位置

不要把 secret key 写进 `.env.example`、文档、Issue、聊天记录或 commit。

本地开发填项目根目录：

```env
AI_ENABLE_WEB_SEARCH=true
TAVILY_API_KEY=
EXA_API_KEY=
JINA_API_KEY=
FIRECRAWL_API_KEY=
DASHSCOPE_API_KEY=
```

推荐填 `.env.local`；如果项目当前主要读取 `.env`，也可以填 `.env`。这两个文件都必须保持
git ignored。

线上部署填平台环境变量：

```env
AI_ENABLE_WEB_SEARCH=true
TAVILY_API_KEY=...
EXA_API_KEY=...
JINA_API_KEY=...
FIRECRAWL_API_KEY=...
DASHSCOPE_API_KEY=...
```

## 最小可用组合

### 只想先跑通

```env
TAVILY_API_KEY=...
EXA_API_KEY=...
JINA_API_KEY=...
```

这能跑出多路检索和 Jina Reader 兜底，但复杂页面抽取和 Qwen3 rerank 质量不完整。

### 完整高级链路

```env
TAVILY_API_KEY=...
EXA_API_KEY=...
JINA_API_KEY=...
FIRECRAWL_API_KEY=...
DASHSCOPE_API_KEY=...
```

这是当前推荐生产形态。

## 验证步骤

配置 key 后先跑基础质量检查：

```bash
bun run lint
bun run typecheck
SKIP_ENV_VALIDATION=true bun run build
```

然后启动服务：

```bash
bun dev
```

手工 smoke test：

1. 打开访谈或聊天入口。
2. 输入一个明显需要最新信息的问题，例如“帮我基于 Next.js 16 和 AI SDK v6 设计一门前沿课程”。
3. 确认系统能进入 research / 蓝图流程。
4. 检查生成结果里是否有 source id / citations。
5. 检查服务端日志里的 provider trace，确认 Tavily、Exa、Jina、Firecrawl、reranker 是否 used/skipped/failed。

前端可见状态：

- 课程访谈蓝图面板会显示 `Evidence Quality / 联网核验`。
- 默认视图展示来源数、权威来源、已读原文、覆盖域名和证据质量。
- 生成中展示“检索权威来源 → 读取原文 → 去重重排 → 生成蓝图”的产品化进度。
- 后台 research 卡片复用同一套证据质量组件。
- Tavily、Exa、Jina、Firecrawl 供应商状态只放在折叠的“技术细节”里。
- 普通用户看到的是“本次实际使用到的证据质量”，不是裸露的后台 key 配置清单。

如果某个 provider 失败：

- 401：key 错、没保存、环境变量没加载。
- 402：免费额度不足或需要绑定支付。
- 429：rate limit，降低并发或稍后重试。
- 5xx：provider 临时错误，保留 trace，不要静默吞掉。

## 成本策略

默认策略：

- Search 多路并行，但每路 limit 受控。
- Extract 只抽关键页面，不全量 crawl。
- Redis cache 缓存 search/extract 结果。
- freshness window 默认 30/90/180 天。
- 来源分级优先官方 docs、论文、release note、技术博客原文。
- Qwen3 reranker 只重排 evidence chunks。

禁止策略：

- 不接 Serper / Google fallback。
- 不恢复 302 `/rerank` 兼容接口。
- 不把 Firecrawl crawl / agent 设为默认路径。
- 不在前端伪造 citations。
- 不把 key 写入仓库。

## 相关代码

- Research pipeline: [lib/ai/research/web-research.ts](/Users/findbiao/projects/nexusnote/lib/ai/research/web-research.ts)
- Provider schema: [lib/ai/research/source-types.ts](/Users/findbiao/projects/nexusnote/lib/ai/research/source-types.ts)
- Chat web search tool: [lib/ai/tools/chat/web-search.ts](/Users/findbiao/projects/nexusnote/lib/ai/tools/chat/web-search.ts)
- Env schema: [config/env.ts](/Users/findbiao/projects/nexusnote/config/env.ts)
- AI system overview: [docs/AI.md](/Users/findbiao/projects/nexusnote/docs/AI.md)

## 官方来源

- Tavily credits and pricing: https://docs.tavily.com/documentation/api-credits
- Exa getting started: https://exa.ai/docs/reference/getting-started
- Exa pricing: https://exa.ai/pricing
- Jina Reader / Search: https://jina.ai/reader/
- Firecrawl API introduction: https://docs.firecrawl.dev/api-reference/introduction
- Firecrawl pricing: https://www.firecrawl.dev/pricing
- Alibaba Cloud Model Studio API key: https://www.alibabacloud.com/help/en/model-studio/get-api-key
- Alibaba Cloud Model Studio models: https://www.alibabacloud.com/help/en/model-studio/models

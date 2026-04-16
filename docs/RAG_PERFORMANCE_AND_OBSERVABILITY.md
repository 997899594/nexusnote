# RAG 性能与可观测性规范

日期：2026-04-01

## 当前目标

RAG 链路要同时满足三件事：

1. 查询稳定可控
2. 数据量增长后不退化成全表扫描
3. 出问题时能知道卡在哪一步

## 索引规范

### 向量检索

`knowledge_evidence_chunks.embedding` 使用 HNSW 索引：

- `knowledge_evidence_chunks_embedding_hnsw_idx`

`tags.name_embedding` 使用 HNSW 索引：

- `tags_name_embedding_hnsw_idx`

### 关键词检索

`knowledge_evidence_chunks.content` 使用全文检索 GIN 表达式索引：

- `knowledge_evidence_chunks_content_fts_idx`

### 最近数据读取

下列列表页/工作台读取依赖按用户 + 时间排序的索引：

- `notes_user_updated_at_idx`
- `conversations_user_updated_at_idx`
- `courses_user_updated_at_idx`

## 查询规范

### 1. 禁止 `sql.raw()` 拼接过滤条件

像 `source_type IN (...)` 这种条件必须使用参数化片段，不允许自己拼字符串。

原因：

- 增加 SQL 注入风险
- 难以审计
- 查询计划不可控

### 2. Hybrid Search 统一走三步

1. `rewriteQuery`
2. `vectorSearch`
3. `keywordSearch`
4. `RRF fusion`

不要在业务侧随意跳过其中一步并写成另一个“临时检索函数”。

## 可观测性规范

### Trace 入口

统一使用 [createRagTrace](/Users/findbiao/projects/nexusnote/lib/rag/observability.ts)。

它至少记录：

- traceId
- 查询文本或文档 ID
- 是否带用户上下文
- rewrite 是否命中
- vector/keyword 各自返回数量
- embeddings 生成数量
- 总耗时

### 日志策略

- 开发环境默认输出
- 生产环境由 `RAG_DEBUG_LOGS=true` 控制

### 关键链路

已接入：

- [hybrid-search.ts](/Users/findbiao/projects/nexusnote/lib/rag/hybrid-search.ts)
- [chunker.ts](/Users/findbiao/projects/nexusnote/lib/rag/chunker.ts)

后续建议补齐：

- reranker
- context compression
- learn 页面 RAG 调用入口

## 回归检查

每次改 RAG 时至少验证：

1. `bun run typecheck`
2. `SKIP_ENV_VALIDATION=true bun run build`
3. 关键查询在有/无 embedding 时都能返回结果
4. 日志能看出 rewrite、vector、keyword、fusion 各阶段耗时

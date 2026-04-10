# AI Multi-Career Tree Implementation Spec

## Decision

This spec replaces the current hardcoded `golden-path` ontology architecture with an AI-first,
user-scoped career tree pipeline.

Phase 1 decisions:

- Do not reuse the current ontology as a runtime dependency.
- Do not reuse the current mapping tables.
- Do not build a global canonical skill universe first.
- Keep truth scoped to one user.
- Let AI own merge decisions first.
- Keep code ownership over validation, persistence, aggregation, idempotency, and rendering reads.
- Keep page reads snapshot-only. The page must not generate trees from scratch at request time.

This is a direct refactor, not an adapter layer around the old model.

## Product Goal

Given a user's saved course outlines and course progress, generate `1-5` AI-organized candidate
career trees that:

- feel AI-native and dynamic to the user
- remain continuous for the same user across regenerations
- can grow when new courses arrive
- allow user preference without destroying the independent AI recommendation

## Non-Goals

Phase 1 explicitly does not do the following:

- global `skills` truth source
- global `skill_relationships` truth source
- target persona / job goal intake
- note / highlight / chat / project evidence ingestion
- page-time LLM generation
- full graph-theory completeness across all node relationships

## Phase 1 Scope

Phase 1 includes exactly three runtime layers:

1. Course evidence extraction
2. User hidden skill graph
3. Candidate tree snapshots

The visible UI tree is a snapshot representation, not the source of truth.

## Architecture

```mermaid
flowchart LR
  A["Saved Course Outline + Course Progress"] --> B["AI Course Extractor"]
  B --> C["Course Evidence Tables"]
  C --> D["AI Merge Planner"]
  D --> E["User Hidden Skill Graph"]
  E --> F["AI Tree Composer"]
  F --> G["Career Tree Snapshot"]
  G --> H["/golden-path UI"]
  I["User Selected Direction"] --> J["Preference Signal"]
  J --> F
```

## Runtime Flow

### Flow A: Course Save / Backfill

Triggered when:

- a course outline is created
- a course outline is regenerated
- a backfill job is run for historical courses

Steps:

1. Compute `outline_hash`.
2. Deduplicate by `user_id + course_id + outline_hash`.
3. Run AI course extractor.
4. Persist extracted evidence rows.
5. Run AI merge planner against the user's current hidden graph.
6. Apply merge result transactionally to hidden graph tables.
7. Trigger snapshot composition.
8. Persist a new latest snapshot.

### Flow B: Preference Change

Triggered when:

- user manually selects a current tree

Steps:

1. Persist `selected_direction_key`.
2. Increment preference version.
3. Trigger snapshot recomposition.
4. Keep `recommended_direction_key` independent from user preference.

### Flow C: Page Read

Triggered when:

- user opens `/golden-path`
- profile summary or related entry points need career tree data

Steps:

1. Read latest successful snapshot for user.
2. If no eligible saved courses exist, return `status = "empty"`.
3. Do not run extraction, merge, or composition on the read path.

## Data Model

Phase 1 uses new tables only.

### 1. `career_generation_runs`

Purpose:

- auditability
- dedupe
- prompt/model version tracking
- retry and failure visibility

Fields:

| field | type | notes |
| --- | --- | --- |
| `id` | uuid pk | run id |
| `user_id` | uuid | owner |
| `course_id` | uuid nullable | set for extraction / merge runs |
| `kind` | text enum | `extract`, `merge`, `compose` |
| `status` | text enum | `queued`, `running`, `succeeded`, `failed` |
| `idempotency_key` | text unique | dedupe key |
| `model` | text | model used |
| `prompt_version` | text | prompt contract version |
| `input_hash` | text | hash of logical input |
| `output_json` | jsonb nullable | raw structured AI output |
| `error_code` | text nullable | failure type |
| `error_message` | text nullable | internal only |
| `started_at` | timestamptz nullable | lifecycle |
| `finished_at` | timestamptz nullable | lifecycle |
| `created_at` | timestamptz | default now |

### 2. `career_course_skill_evidence`

Purpose:

- structured skill/theme evidence extracted from one course

Fields:

| field | type | notes |
| --- | --- | --- |
| `id` | uuid pk | evidence id |
| `user_id` | uuid | owner |
| `course_id` | uuid | source course |
| `extract_run_id` | uuid fk | source run |
| `title` | text | AI extracted capability label |
| `kind` | text enum | `skill`, `theme`, `tool`, `workflow`, `concept` |
| `summary` | text | short normalized description |
| `confidence` | numeric | `0..1` |
| `chapter_refs` | jsonb | chapter indices / ids |
| `prerequisite_hints` | jsonb | strings or references |
| `related_hints` | jsonb | strings or references |
| `evidence_snippets` | jsonb | source fragments |
| `source_outline_hash` | text | course version binding |
| `created_at` | timestamptz | default now |

### 3. `career_course_chapter_evidence`

Purpose:

- chapter-level evidence slices for supporting chapter lookups in UI

Fields:

| field | type | notes |
| --- | --- | --- |
| `id` | uuid pk | row id |
| `user_id` | uuid | owner |
| `course_id` | uuid | source course |
| `chapter_key` | text | stable chapter key |
| `chapter_index` | integer | 1-based |
| `chapter_title` | text | chapter title |
| `skill_evidence_ids` | uuid[] | linked course evidence rows |
| `confidence` | numeric | `0..1` |
| `created_at` | timestamptz | default now |

### 4. `career_user_skill_nodes`

Purpose:

- stable hidden branches for one user

Fields:

| field | type | notes |
| --- | --- | --- |
| `id` | uuid pk | stable hidden node id |
| `user_id` | uuid | owner |
| `canonical_label` | text | hidden normalized label, may change slowly |
| `display_hint` | text nullable | optional internal display hint |
| `summary` | text nullable | internal merged summary |
| `kind` | text enum | `skill`, `theme`, `cluster` |
| `state` | text enum | `mastered`, `in_progress`, `ready`, `locked` |
| `progress` | integer | `0..100`, code-aggregated |
| `mastery_score` | integer | `0..100`, code-aggregated |
| `evidence_score` | integer | aggregate strength |
| `course_count` | integer | aggregate |
| `chapter_count` | integer | aggregate |
| `last_merged_at` | timestamptz | last update |
| `created_at` | timestamptz | default now |
| `updated_at` | timestamptz | default now |

### 5. `career_user_skill_edges`

Purpose:

- sparse hidden relationships inside one user's graph

Phase 1 rule:

- only persist high-confidence useful edges
- do not attempt full graph completeness

Fields:

| field | type | notes |
| --- | --- | --- |
| `id` | uuid pk | edge id |
| `user_id` | uuid | owner |
| `from_node_id` | uuid | source hidden node |
| `to_node_id` | uuid | target hidden node |
| `edge_type` | text enum | `prerequisite`, `related`, `supports` |
| `confidence` | numeric | `0..1` |
| `source_merge_run_id` | uuid fk | provenance |
| `created_at` | timestamptz | default now |

### 6. `career_user_skill_node_evidence`

Purpose:

- many-to-many link between hidden nodes and extracted evidence rows

Fields:

| field | type | notes |
| --- | --- | --- |
| `id` | uuid pk | link id |
| `user_id` | uuid | owner |
| `node_id` | uuid | hidden node |
| `course_skill_evidence_id` | uuid | evidence row |
| `merge_run_id` | uuid fk | provenance |
| `weight` | numeric | contribution weight |
| `created_at` | timestamptz | default now |

Unique key:

- `node_id + course_skill_evidence_id`

### 7. `career_user_tree_preferences`

Purpose:

- store user-selected direction preference as ranking signal

Fields:

| field | type | notes |
| --- | --- | --- |
| `user_id` | uuid pk | owner |
| `selected_direction_key` | text nullable | current preferred tree |
| `selection_count` | integer | optional feedback weight |
| `updated_at` | timestamptz | default now |

### 8. `career_user_tree_snapshots`

Purpose:

- materialized page read model

Phase 1 choice:

- store full snapshot as JSONB
- do not prematurely normalize visible tree payload

Fields:

| field | type | notes |
| --- | --- | --- |
| `id` | uuid pk | snapshot id |
| `user_id` | uuid | owner |
| `compose_run_id` | uuid fk | provenance |
| `status` | text enum | `empty`, `ready` |
| `recommended_direction_key` | text nullable | AI recommendation |
| `selected_direction_key` | text nullable | copied from preferences |
| `graph_version` | integer | hidden graph version used |
| `preference_version` | integer | preference version used |
| `payload` | jsonb | full `GoldenPathSnapshot` payload |
| `is_latest` | boolean | only one latest per user |
| `generated_at` | timestamptz | logical timestamp |
| `created_at` | timestamptz | default now |

## Read Models

### `GoldenPathSnapshot`

```ts
interface GoldenPathSnapshot {
  status: "empty" | "ready";
  recommendedDirectionKey: string | null;
  selectedDirectionKey: string | null;
  trees: CandidateCareerTree[];
  generatedAt: string;
}
```

### `CandidateCareerTree`

```ts
interface CandidateCareerTree {
  directionKey: string;
  title: string;
  summary: string;
  confidence: number;
  whyThisDirection: string;
  supportingCourses: SupportingCourseRef[];
  supportingChapters: SupportingChapterRef[];
  tree: VisibleSkillTreeNode[];
}
```

### `VisibleSkillTreeNode`

```ts
interface VisibleSkillTreeNode {
  id: string;
  anchorRef: string;
  title: string;
  summary: string;
  progress: number;
  state: "mastered" | "in_progress" | "ready" | "locked";
  children: VisibleSkillTreeNode[];
  evidenceRefs?: string[];
}
```

## AI Contracts

All AI steps must use structured JSON outputs with strict schema validation.

### Contract A: Course Extractor

Input:

- course title
- course description
- outline data
- explicit `courseSkillIds`
- explicit `chapter.skillIds`

Output:

```json
{
  "items": [
    {
      "title": "Prompt orchestration",
      "kind": "skill",
      "summary": "Designing and sequencing prompts for multi-step AI workflows",
      "confidence": 0.92,
      "chapterRefs": ["chapter-2", "chapter-3"],
      "prerequisiteHints": ["Basic prompting"],
      "relatedHints": ["Tool calling", "Agent workflows"],
      "evidenceSnippets": ["Design multi-step agents", "Chain prompts with tools"]
    }
  ]
}
```

Rules:

- explicit course/chapter skill ids are injected as high-confidence context
- extractor may add additional evidence
- extractor must not emit progress/state

### Contract B: Merge Planner

Input:

- current hidden nodes for user
- current hidden edges for user
- new evidence rows from current course
- optional prior merge summary for same user

Output:

```json
{
  "decisions": [
    {
      "action": "attach",
      "targetNodeId": "uuid",
      "evidenceIds": ["uuid-1", "uuid-2"],
      "confidence": 0.87,
      "reason": "Same capability branch despite wording difference"
    },
    {
      "action": "create",
      "newNode": {
        "canonicalLabel": "Agent tool orchestration",
        "summary": "Sequencing tools in AI agent loops",
        "kind": "skill"
      },
      "evidenceIds": ["uuid-3"],
      "confidence": 0.79,
      "reason": "No close existing branch"
    }
  ],
  "edgeDecisions": [
    {
      "type": "prerequisite",
      "from": "existing-or-new-ref",
      "to": "existing-or-new-ref",
      "confidence": 0.72
    }
  ]
}
```

Phase 1 merge rule:

- AI owns attach/create decisions first
- code does not substitute its own semantic matcher
- code only validates and applies safe writes

Code guardrails:

- referenced `targetNodeId` must belong to user
- `evidenceIds` must belong to current run payload
- created node count per course is capped
- self-edges are rejected
- prerequisite cycles are dropped

### Contract C: Tree Composer

Input:

- user hidden graph
- latest preference
- previous snapshot keys and tree summaries

Output:

```json
{
  "recommendedDirectionHint": "ai-product-systems",
  "trees": [
    {
      "matchPreviousDirectionKey": "ai-product-systems",
      "keySeed": "ai-product-systems",
      "title": "AI 产品系统设计",
      "summary": "围绕产品思维、工作流设计与系统落地的职业方向",
      "confidence": 0.88,
      "whyThisDirection": "Most evidence clusters around product + agent workflow nodes",
      "supportingNodeRefs": ["node-a", "node-b", "node-c"],
      "tree": [
        {
          "anchorRef": "node-a",
          "title": "AI 产品判断",
          "summary": "定义问题和设计能力边界",
          "children": []
        }
      ]
    }
  ]
}
```

Rules:

- composer may rename and regroup visible branches
- composer may not invent non-existent anchor refs
- composer may not invent progress/state
- composer should return `1-2` trees on weak signal, `2-5` on stronger signal

## Stable Identity Rules

### Hidden Node Identity

- hidden node continuity is guaranteed by persisted `career_user_skill_nodes.id`
- AI merge attaches new evidence to old node ids where appropriate
- visible names may change, hidden node ids do not

### `directionKey`

`directionKey` must not be the raw title.

Generation rule:

1. Composer attempts to match each new tree to a previous snapshot tree.
2. If matched, inherit previous `directionKey`.
3. If no match exists, derive a new key from `keySeed`.
4. Enforce uniqueness inside snapshot.

Code finalizer:

- normalize key seed to slug
- preserve prior key when `matchPreviousDirectionKey` is valid
- append suffix only on collision

## Aggregation Rules

AI does not set progress/state as truth.

Code computes them from graph evidence and course progress.

Phase 1 deterministic aggregation:

- `progress` = weighted completion across linked evidence chapters
- `mastery_score` = weighted completion + repeated evidence support
- `course_count` = distinct linked courses
- `chapter_count` = distinct linked chapters

State rule:

- `mastered`: `progress >= 80` and evidence strong
- `in_progress`: `progress >= 30`
- `ready`: low progress but unlocked by graph context
- `locked`: insufficient evidence and blocked by prerequisite edges

Exact thresholds should live in code constants.

## Snapshot Policy

Latest snapshot is regenerated when:

- hidden graph version changes
- preference version changes

Snapshot creation rule:

- latest successful snapshot remains active until a new compose run succeeds
- failed compose runs do not delete the previous snapshot

## API

### `GET /api/user/golden-path`

Returns:

- latest `GoldenPathSnapshot`

Behavior:

- no courses -> `status = "empty"`
- latest snapshot available -> return snapshot
- snapshot missing but graph exists -> optionally return last known snapshot and trigger async rebuild

### `PUT /api/user/golden-path`

Body:

```json
{
  "selectedDirectionKey": "ai-product-systems"
}
```

Behavior:

- persist preference
- trigger recomposition
- return updated snapshot or accepted state

## Jobs

Phase 1 background jobs:

1. `extract_course_evidence`
2. `merge_user_skill_graph`
3. `compose_user_career_trees`
4. `backfill_user_career_trees`

Recommended execution model:

- queue-backed jobs
- one user-level merge lock at a time
- one latest compose lock at a time per user

## Idempotency

### Extraction

Key:

- `extract:user:{userId}:course:{courseId}:outline:{outlineHash}`

### Merge

Key:

- `merge:user:{userId}:course:{courseId}:extract_run:{runId}`

### Compose

Key:

- `compose:user:{userId}:graph:{graphVersion}:pref:{preferenceVersion}`

## Failure Strategy

If extraction fails:

- keep previous user graph unchanged
- expose internal failure only in logs/run table

If merge fails:

- do not partially apply graph updates
- transaction rollback required

If compose fails:

- keep previous latest snapshot
- page continues reading last successful snapshot or empty state

## Caching

Read cache key:

- current user latest snapshot

Invalidate on:

- successful merge
- successful compose
- successful preference update

## Codebase Changes

### Remove / Replace

- replace [lib/golden-path/types.ts](/Users/findbiao/projects/nexusnote/lib/golden-path/types.ts)
- replace [lib/server/golden-path-data.ts](/Users/findbiao/projects/nexusnote/lib/server/golden-path-data.ts)
- remove runtime dependency on `lib/golden-path/ontology`
- remove old `routes / futureRoutes` assumptions from UI

### Add

- `db/schema/career-tree.ts`
- `lib/career-tree/extract.ts`
- `lib/career-tree/merge.ts`
- `lib/career-tree/compose.ts`
- `lib/career-tree/snapshot.ts`
- `lib/career-tree/prompts/*`
- `scripts/backfill-career-trees.ts`

### UI Surface To Update

- [app/golden-path/page.tsx](/Users/findbiao/projects/nexusnote/app/golden-path/page.tsx)
- [components/golden-path/GoldenPathExplorer.tsx](/Users/findbiao/projects/nexusnote/components/golden-path/GoldenPathExplorer.tsx)
- [components/profile/ProfileGoldenPathSummary.tsx](/Users/findbiao/projects/nexusnote/components/profile/ProfileGoldenPathSummary.tsx)
- [app/api/user/golden-path/route.ts](/Users/findbiao/projects/nexusnote/app/api/user/golden-path/route.ts)

## Migration / Cutover

### Step 1

- add new schema and code paths
- do not read from new tables yet

### Step 2

- backfill all users with saved courses
- inspect run failures and snapshot quality

### Step 3

- switch `GET /api/user/golden-path` to snapshot read path
- keep old path behind feature flag for one release window if needed

### Step 4

- remove old ontology-based server projection logic
- delete hardcoded ontology runtime dependency

## Test Plan

### Consistency

- same user + same course set => hidden node ids stay continuous
- visible names may change, progress may not reset

### Growth

- adding one new course grows existing branches before creating many new nodes

### Weak Signal

- weak users produce `1-2` high-confidence trees only

### Strong Signal

- stronger users produce `2-5` trees

### Preference

- selected tree affects ordering
- AI recommendation remains separately visible

### Empty State

- no saved courses returns `status = "empty"`

### Engineering Baseline

- `bun run typecheck`
- `bun run lint`
- fixture-based generation stability script

## Open Decisions

These decisions should be resolved before implementation starts:

1. Which exact model handles extraction, merge, and composition
2. Whether merge and compose run synchronously after course save or through queue only
3. Whether hidden graph version is an integer counter or derived hash
4. Whether `career_user_skill_edges` ships in Phase 1 with all three edge types or only `prerequisite`

## Recommendation

Start with this implementation shape exactly:

- AI owns extraction
- AI owns attach/create merge plan
- code owns validation and aggregation
- snapshots are JSONB
- UI reads snapshots only
- old ontology is removed after cutover

This is the narrowest design that still produces a real AI-native multi-career-tree system.

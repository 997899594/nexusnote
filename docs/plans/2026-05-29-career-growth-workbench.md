# Career Growth Graph Workbench Implementation Plan

**Goal:** Make career planning and career trees one fused career growth product.

**Architecture:** The career tree is the only durable user-facing object. The mentor interview is an
interaction layer that reads course evidence and user answers, then emits graph patches that create,
calibrate, or revise the career tree. `/career-trees` is canonical; `/career` only redirects to the
same workbench.

**Tech Stack:** Next.js 16, React 19, TypeScript, AI SDK v6 `UIMessage.parts`, Drizzle, PostgreSQL
JSONB revision storage, Tailwind.

---

## 1. Product Decision

Career planning is not a second module beside the career tree. It is the way the user changes the
tree.

The product has one object:

```text
CareerGrowthGraph
```

The product has one interaction layer:

```text
CareerPlanningMentor
```

The mentor never owns a separate map. Each turn produces a structured `CareerGraphPatch`:

```text
user answer or intent
  -> mentor interprets with evidence
  -> server emits CareerGraphPatch
  -> UI highlights the proposed graph change
  -> revision is appended
  -> tree remains the durable state
```

This preserves from-zero planning and evidence-backed planning without splitting the product.

## 2. Object Model

### CareerGrowthGraph

`CareerGrowthGraph` is the conceptual product object. It is projected from existing career tree
snapshots plus planning revisions.

Node types:

- `current_skill`: evidence-backed skill from courses, notes, or existing career tree nodes.
- `target_role`: role or work shape the user may pursue.
- `future_path`: strategic route between current skills and target roles.
- `skill_gap`: missing capability, proof, or constraint.
- `validation_task`: small real-world task used to test fit.
- `course`: course evidence or recommended learning input.
- `evidence`: source signal from course, note, research, or interview.

Edge types:

- `supports`: evidence or course supports a skill, path, or role.
- `requires`: role or path requires a gap to be closed.
- `bridges_to`: current state can move toward a future path.
- `validates`: task validates a path, role, or skill claim.
- `learns_from`: course or learning artifact can reduce a gap.

### CareerGraphPatch

`CareerGraphPatch` is the only structured output of the interview.

Required fields:

- `intent`: what this turn is trying to clarify.
- `operation`: `create`, `calibrate`, `redirect`, or `commit`.
- `summary`: one restrained internal summary of the graph change.
- `nodes`: proposed nodes to add or update.
- `edges`: proposed edges to add or update.
- `highlightNodeIds`: nodes the UI may emphasize.
- `confidence`: `low`, `medium`, or `high`; not a fake percentage.
- `evidence`: compact source references used by the patch.
- `diagnosis`: hidden professional diagnosis frame for this turn.
- `interviewTechnique`: the counselor technique used for the next question.
- `qualityGate`: self-check that the patch changes the graph and reduces uncertainty.
- `nextQuestion`: one open-ended mentor calibration question.

Rules:

- A patch may have zero nodes when the mentor is still calibrating a vague answer.
- A patch must always have `nextQuestion`.
- Subjective answers may create provisional nodes but must not mark skills as mastered.
- Evidence-backed course progress remains authoritative.
- User intent can create future nodes and validation tasks immediately.
- Existing tree node ids should be reused in `highlightNodeIds` when the patch references known
  skills, gaps, or routes.
- `diagnosis` and `qualityGate` are internal product data. The UI must not render them as panels.

## 3. Starting Modes

The UI does not expose mode names. The distinction is internal.

### No Tree Yet

When `CareerTreeSnapshot.status` is `empty` or no route exists:

- The interview is the primary surface.
- The mentor asks one professional calibration question.
- The graph starts as provisional.
- Each answer can create target roles, paths, gaps, or validation tasks.
- The tree can later be promoted from provisional graph to official evidence-backed tree.

No-tree users must not be told to first create a course. The platform can still use course creation
later as one possible validation or learning action.

### Existing Tree

When a career tree exists:

- The tree canvas is the main object.
- The mentor proposes graph patches against the current tree.
- Answers can change target roles, confidence, gaps, next tasks, and future path nodes.
- Existing evidence-backed skill state is not overwritten by preferences.
- Proposed changes are saved as append-only planning revisions.

## 4. Professional Interview Behavior

The mentor should feel like a strong career planner, not a form.

### Hidden Diagnostic Frame

Every turn carries a hidden diagnostic frame. The frame is not copy for the user. It exists so the
AI has to do the work a real counselor would do before asking:

- `motivation`: what appears to energize the user.
- `capabilityEvidence`: what existing courses, tree nodes, answers, or artifacts prove.
- `constraints`: limits that may change route feasibility.
- `workStyle`: how the user seems to prefer operating.
- `targetHypothesis`: current best-fit role or work-shape hypothesis.
- `marketHypothesis`: role-market assumption that may need research or validation.
- `risk`: biggest wrong-turn risk.
- `nextValidation`: the smallest next signal that would raise confidence.

### Counselor Techniques

The mentor chooses one technique per turn:

- `achievement_event`: ask for a concrete satisfying work event.
- `counterfactual_tradeoff`: force a real trade-off between two attractive paths.
- `constraint_probe`: surface time, money, geography, energy, or identity constraints.
- `evidence_probe`: ask for proof, artifacts, courses, or outcomes instead of self-labels.
- `failure_sample`: examine a failed or draining work sample.
- `market_calibration`: test the hypothesis against real role requirements.
- `validation_design`: turn uncertainty into a small experiment or portfolio task.

### Quality Gate

The AI must self-check each patch before calling `presentCareerGraphPatch`:

- `changesGraph`: this turn can create, revise, highlight, or validate a graph node.
- `reducesUncertainty`: the next question distinguishes between plausible paths.
- `evidenceBounded`: skill claims remain bounded by available evidence.
- `notProfileDump`: the user is not being asked to dump a full profile.
- `nextQuestionPurpose`: one concise reason this exact question is worth asking now.

If the gate fails, the model must repair the patch before tool output. Code validates structure; the
model owns professional judgment.

### Behavior Rules

It must:

- Ask one high-leverage question per turn.
- Use existing course and tree evidence before asking for new information.
- Convert vague answers into comparable target nodes.
- Ask counterfactual or trade-off questions when the answer is too broad.
- Map intent backward into missing evidence, portfolio tasks, and learning actions.
- Prefer validation tasks over abstract advice.
- Use web research only as evidence for role requirements, not as a visible research panel.
- Use existing tree nodes as anchors when present, and use from-zero answers to seed future nodes
  when no tree exists.
- Feed graph feedback back into the main canvas through subtle highlights, not a separate dashboard.

It must not:

- Ask the user to dump profile data.
- Show question counters.
- Show internal mode, provider, tool, or research wording.
- Print long planning summaries into the chat.
- Expose a standalone `career map`.
- Turn subjective confidence into mastered skill progress.

## 5. UX Contract

### Desktop With Tree

```text
left: direction rail
center: career tree canvas
right: mentor
```

The right panel is not a dashboard. It is a calm interview surface. It shows:

- the current mentor question;
- compact choices when useful;
- the user's answers;
- a subtle loading state.

It does not show route cards, evidence walls, debug labels, or draft summaries.

### Desktop Without Tree

```text
main: mentor interview
```

The page can show a minimal header and composer, but no fake graph, fake metrics, or placeholder
dashboard.

### Mobile

Default state:

- no tree: interview first;
- existing tree: tree first, mentor reachable as the active work area.

Interactions:

- each turn shows only the active question and answer choices;
- prior structured thinking is folded into the graph revision, not displayed as a pile of text;
- the composer remains simple: direct answer, no overloaded controls.

## 6. Persistence Boundary

Persist:

- append-only planning revisions;
- graph patches;
- selected route key if the patch targets an existing direction;
- compact source snapshot and signals used to build the patch.

Do not persist:

- chat transcript as canonical state;
- frontend-only loading state;
- model free text as the source of truth;
- old `CareerMapDraft` structures.

Physical DB note:

- Existing `career_plan_revisions.map_json` may remain as a physical JSONB column during this
  implementation.
- Application code must treat it as graph patch storage: `{ graphPatch, currentRoute, metrics }`.
- If a destructive schema sync is scheduled, rename the physical column later; do not block the
  product model on that migration.

## 7. AI SDK v6 Contract

Use:

- `ToolLoopAgent` for the mentor conversation.
- `presentCareerGraphPatch` for same-turn structured graph output.
- `UIMessage.parts` parsing on the client.

Do not:

- parse JSON from assistant text;
- require the user to see tool output;
- rely only on prompt wording to enforce product behavior.
- hard-code mentor questions, option buttons, or interview branches in frontend/backend code.

The frontend may send an internal bootstrap message to start the mentor, but the mentor question,
graph nodes, evidence, and next action must come from AI through `presentCareerGraphPatch`.
The career mentor must not generate or render multiple-choice answer buttons.

## 8. Implementation Tasks

### Task 1: Replace Planning Schema

Files:

- Modify: `lib/ai/career-planning/schemas.ts`

Steps:

1. Delete `CareerMapDraft` schemas.
2. Add `careerGraphPatchSchema`.
3. Add `diagnosis`, `interviewTechnique`, and `qualityGate`.
4. Export `CareerGraphPatch`.
5. Keep the schema flexible enough for early calibration turns: zero nodes and zero edges are valid;
   `nextQuestion` is required.

Acceptance:

- No application code imports `CareerMapDraft`.
- Tool input validation does not fail when the model asks a pure calibration question.
- Saved graph patches contain the hidden diagnostic frame and quality gate.

### Task 2: Remove Mentor Seed Builder

Files:

- Delete: `lib/career-planning/mentor-draft.ts`
- Modify: `components/career-trees/CareerPlanningMentorPanel.tsx`

Steps:

1. Remove code-generated first questions and branch scripts.
2. Let the panel send an internal bootstrap message when no AI patch exists.
3. Hide the bootstrap message from the UI.
4. Render a restrained loading state until AI returns `presentCareerGraphPatch`.

Acceptance:

- No-tree users see an AI-generated mentor question.
- No text tells users to first create a course or generate a snapshot.

### Task 3: Replace Workspace Prompt Context

Files:

- Modify: `lib/career-planning/workspace-data.ts`

Steps:

1. Delete backend patch generation from career workspace data.
2. Keep route, gap, course, metric, and signal extraction as AI context.
3. Teach AI that `__career_planning_mentor_bootstrap__` is an internal start signal.
4. Require `presentCareerGraphPatch` for each planning turn.
5. Require the model to select a counselor technique and pass the quality gate before tool output.

Acceptance:

- Existing-tree users get AI-generated graph patches grounded in current evidence.
- Planning prompt no longer references maps, draft routes, or code-generated questions.
- Prompt context names reusable tree node ids so AI can highlight existing nodes instead of inventing
  a parallel map.

### Task 4: Replace AI Tool

Files:

- Modify: `lib/ai/tools/career/planning.ts`
- Modify: `lib/ai/tools/shared/display-contract.ts`
- Modify: `lib/ai/specialists/conversation-agent.ts`
- Modify: `lib/ai/prompts/resources/career-guide.md`

Steps:

1. Replace `presentCareerMapDraft` with `presentCareerGraphPatch`.
2. Update forced first tool call.
3. Keep the tool presentation as `state`.
4. Keep mentor body concise and avoid structured data in free text.
5. Describe diagnostic frame and quality gate in the tool contract.

Acceptance:

- Planning entry always produces a structured graph patch.
- The chat UI does not render the tool as a visible technical artifact.

### Task 5: Remove API Seeded Patch

Files:

- Modify: `app/api/chat/route.ts`

Steps:

1. Remove `data-careerMapDraft`.
2. Do not seed `data-careerGraphPatch` from backend scripts.
3. Let `presentCareerGraphPatch` be the authoritative structured mentor output.

Acceptance:

- The mentor panel renders from AI tool parts.
- No old data part type remains in the career planning flow.

### Task 6: Replace Revision State

Files:

- Modify: `lib/career-planning/state.ts`
- Modify: `lib/career-planning/revisions.ts`
- Modify: `app/api/career-planning/revisions/route.ts`
- Modify: `app/api/career-planning/current-route/route.ts`

Steps:

1. Rename application-level inputs from `mapDraft` to `graphPatch`.
2. Persist graph patch under `mapJson.graphPatch`.
3. Derive title and summary from patch target nodes or current route.
4. Stop parsing old `mapJson.draft`.

Acceptance:

- New revisions contain graph patches only.
- Old draft revisions are ignored instead of rendered.

### Task 7: Replace Mentor Panel Parsing

Files:

- Modify: `components/career-trees/CareerPlanningMentorPanel.tsx`

Steps:

1. Parse `presentCareerGraphPatch` tool parts.
2. Render only the next question and options.
3. Save `graphPatch` revisions.
4. Remove map/draft naming and any route-card assumptions.
5. Notify the workbench when the latest patch changes so the tree can react.

Acceptance:

- The panel remains restrained.
- No `职业地图`, `路径假设`, `第几个问题`, or technical wording is visible.

### Task 8: Feed Patch Back Into The Tree

Files:

- Modify: `components/career-trees/CareerTreesExplorer.tsx`
- Modify: `components/career-trees/CareerTreeGraph.tsx`

Steps:

1. Store the latest mentor patch in the workbench.
2. Merge streamed patch highlights with restored revision highlights.
3. Pass `highlightNodeIds` into the graph.
4. Highlight existing tree nodes and related edges subtly.
5. Do not render diagnosis, quality gate, or evidence as visible panels.

Acceptance:

- When the mentor references known tree nodes, the main graph visually responds.
- Unknown future nodes remain persisted in the patch but do not create fake canvas nodes.
- The interaction stays calm: no debug badges, counters, or extra dashboards.

### Task 9: Verify

Commands:

```bash
bun run lint
bun run typecheck
SKIP_ENV_VALIDATION=true bun run build
```

Manual QA:

- Open `/career-trees` after dev login.
- Verify no-tree state starts with a mentor question.
- Verify existing-tree state shows the tree and mentor panel.
- Confirm `/career` redirects to `/career-trees?mentor=planning`.
- Search for old user-visible terms and old tool/data names.

## 9. Acceptance Criteria

- `/career-trees` is the only career growth workspace.
- `/career` is not an independent career planning page.
- Career planning emits graph patches, not map drafts.
- Existing trees can be revised by interview answers.
- No-tree users can start from zero and grow a provisional graph.
- Evidence-backed skill progress is not overwritten by interview claims.
- UI remains calm, concise, and professional.
- The mentor asks one high-leverage question per turn.
- Structured AI output uses AI SDK v6 `UIMessage.parts`.
- Static checks and production build pass.

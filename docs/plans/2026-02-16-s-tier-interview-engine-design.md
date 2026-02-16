# S-Tier Interview Engine Design

> Date: 2026-02-16
> Status: Approved
> Scope: Full rewrite of AI interview system + course generation pipeline

## Problem Statement

The current interview agent is a form wizard with 4 fixed phases, fixed button options, and client-side state derivation. It produces mediocre course outlines because it doesn't adapt to domain complexity or user context.

The interview IS the product. If the interview is intelligent, the outline and course quality follow.

## Core Design Principles

1. **AI controls the flow, code provides tools** — no fixed phases, no hardcoded round counts
2. **Options always appear, never required** — every turn has dynamic buttons, user can type instead
3. **Server-side profile is the source of truth** — not derived from message history
4. **Flash for conversation, Pro for outline** — speed where it matters, depth where it matters
5. **Background jobs for course generation** — BullMQ, not fire-and-forget fetch

---

## 1. Interview Agent

### 1.1 Model Strategy

- **Interview conversation**: Gemini 3 Flash via `registry.chatModel` (sub-second latency)
- **Outline generation**: Gemini 3 Pro via `registry.courseModel` (deep reasoning)

### 1.2 LearnerProfile Data Structure

```typescript
interface LearnerProfile {
  // Core dimensions (nullable, AI fills as conversation progresses)
  goal: string | null;
  background: string | null;
  targetOutcome: string | null;
  constraints: string | null;       // time, tools, budget
  preferences: string | null;       // learning style preferences

  // AI-inferred metadata
  domain: string | null;            // "cooking", "quantum-computing", etc.
  domainComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'expert';
  goalClarity: 'vague' | 'clear' | 'precise';
  backgroundLevel: 'none' | 'beginner' | 'intermediate' | 'advanced';

  // Free-form insights
  insights: string[];               // e.g. ["user has an exam next month"]

  // Readiness assessment
  readiness: number;                // 0-100, AI judges each turn
  missingInfo: string[];            // what AI thinks is still needed
}
```

### 1.3 Tools

```
updateProfile    server-side   MANDATORY every turn   Merge extracted info into DB
suggestOptions   client-side   MANDATORY every turn   Dynamic options, user can ignore and type
proposeOutline   client-side   TERMINAL signal        Replaces suggestOptions when readiness >= 80
```

- `updateProfile` has `execute` → runs server-side → loop continues
- `suggestOptions` has NO `execute` → stops loop → waits for user
- `proposeOutline` has NO `execute` → stops loop → client shows confirmation UI

Every turn the AI MUST call either `suggestOptions` or `proposeOutline` (both client-side, both stop the loop).

### 1.4 Stop Conditions

```typescript
stopWhen: [
  hasToolCall('suggestOptions'),   // pause for user input each turn
  hasToolCall('proposeOutline'),   // interview complete
  stepCountIs(15),                 // safety limit
]
```

### 1.5 prepareStep

Each step loads the latest profile from DB and rebuilds the system prompt:

```typescript
prepareStep: async ({ stepNumber }) => {
  const profile = await getProfile(sessionId);
  return {
    instructions: buildInterviewPrompt(profile),
  };
}
```

### 1.6 System Prompt Strategy

Dynamic prompt built from current LearnerProfile state. Key elements:
- Persona: experienced learning consultant, talks like a knowledgeable friend
- One topic per turn, natural conversation
- Depth adapts to domain complexity:
  - trivial/simple: 1-3 turns
  - moderate: 3-5 turns
  - complex/expert: 5-10 turns
- Tool rules: updateProfile mandatory, suggestOptions mandatory, proposeOutline when ready
- Current profile state injected (what's known, what's missing, readiness score)

### 1.7 User Interaction

Two paths, both route to `addToolOutput`:

1. **Click option** → `addToolOutput({ toolCallId, output: { selected: "clicked option" } })`
2. **Type free text** → detect pending `suggestOptions` → `addToolOutput({ toolCallId, output: { selected: "typed text" } })`

If no pending client-side tool (edge case), fall through to `sendMessage`.

---

## 2. Server-Side Profile Management

### 2.1 Database Schema

```sql
CREATE TABLE interview_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL REFERENCES users(id),
  initial_goal      TEXT NOT NULL,
  profile           JSONB NOT NULL DEFAULT '{}',
  status            TEXT NOT NULL DEFAULT 'interviewing',
  -- 'interviewing' | 'proposing' | 'confirmed' | 'generating' | 'completed'
  messages          JSONB DEFAULT '[]',
  proposed_outline  JSONB,
  confirmed_outline JSONB,
  course_id         UUID REFERENCES courses(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 Profile Merge

Partial update semantics. `insights` array appends, other fields overwrite if non-null.

### 2.3 Message Persistence

Store UIMessages in `interview_sessions.messages` (JSONB). On page reload, restore via `useChat({ initialMessages })`. No more localStorage.

---

## 3. Interview → Outline Transition

### 3.1 Flow

1. AI calls `proposeOutline({ summary, suggestedTitle })` when readiness >= 80
2. `hasToolCall('proposeOutline')` stops the loop
3. Client renders confirmation UI with summary
4. User confirms → triggers outline generation
5. User adjusts → `addToolOutput({ action: 'adjust', feedback })` → interview continues

### 3.2 Outline Generation

Server-side, using Pro model:

1. Load profile from DB
2. (Optional) Run `topicResearchAgent` for complex domains
3. Run `curriculumDesignerAgent` (Pro) with profile + research
4. Store outline in `interview_sessions.proposed_outline`
5. Return to client for review

### 3.3 Outline Confirmation

User can edit/approve. On approval:
1. Store in `interview_sessions.confirmed_outline`
2. Create course record
3. Enqueue BullMQ job for chapter generation

---

## 4. Course Generation (BullMQ)

### 4.1 Architecture

```
POST /api/course/create
  → Create course record in DB
  → Enqueue BullMQ job
  → Return courseId

BullMQ Worker (k3s deployment):
  → For each chapter in outline:
      → courseGenerationAgent.generate() (Pro model)
      → saveChapterContent to DB
      → Update job progress
  → markComplete

GET /api/course/[id]/progress (SSE)
  → Stream job progress to client
  → Client shows real-time generation status
```

### 4.2 Benefits over current fire-and-forget

- Retry on failure (BullMQ built-in)
- Progress tracking (SSE to client)
- Browser-independent (runs in worker)
- Resumable (job state persisted in Redis)

---

## 5. Client-Side Simplification

### 5.1 Hook Decomposition

Current: 1 God Hook (574 lines) doing everything.

After:
- `useInterview(sessionId)` — chat + option handling
- `useCourseProgress(courseId)` — SSE progress subscription

### 5.2 Phase State Machine

```
interviewing → proposing → reviewing → generating → completed
```

Driven by server-side `interview_sessions.status`, not client-side setTimeout chains.

### 5.3 No More Client-Side Context Derivation

Delete the `useMemo` that scans message history to infer `interviewContext`. Profile comes from DB.

---

## 6. Prompt System Consolidation

Delete `getSystemPrompt()` from `interview-agent.ts`. Single source of truth: `prompts/interview.ts` → `buildInterviewPrompt(profile)`.

Agent uses `prepareStep` to inject prompt dynamically, no static `instructions`.

---

## 7. API Route Changes

### Modified
- `POST /api/chat` — INTERVIEW intent now requires `sessionId`, creates session if missing

### New
- `POST /api/course/create` — confirm outline, enqueue generation
- `GET /api/course/[id]/progress` — SSE progress stream
- `GET /api/interview/[id]` — restore session (profile + messages)

---

## 8. File Changes Summary

### Delete
- `features/learning/agents/interview/agent.ts` (old agent)
- `features/learning/tools/interview.ts` (old tools)

### Rewrite
- `features/learning/agent/interview-agent.ts` — new agent with updateProfile, suggestOptions, proposeOutline
- `features/shared/ai/prompts/interview.ts` — new dynamic prompt builder based on LearnerProfile
- `features/learning/hooks/useCourseGeneration.ts` — split into useInterview + useCourseProgress
- `features/learning/components/create/ChatInterface.tsx` — new phase state machine
- `app/api/chat/route.ts` — sessionId support

### New
- `features/learning/types.ts` — LearnerProfile type + schemas
- `features/learning/services/interview-session.ts` — DB CRUD
- `features/learning/services/outline-generator.ts` — Pro model outline generation
- `app/api/course/create/route.ts` — BullMQ job trigger
- `app/api/course/[id]/progress/route.ts` — SSE endpoint
- `lib/queue/course-worker.ts` — BullMQ worker
- `lib/queue/index.ts` — Queue configuration
- DB migration for `interview_sessions` table

### Unchanged
- `features/shared/ai/registry.ts` — model config stays
- `features/shared/ai/fallback-model.ts` — fallback stays
- `features/shared/ai/circuit-breaker.ts` — circuit breaker stays
- `features/shared/ai/rag.ts` — RAG stays
- `features/chat/agents/chat-agent.ts` — chat agent stays
- `features/shared/components/ai/PartsBasedMessage.tsx` — already fixed
- `features/chat/components/ai/UnifiedChatUI.tsx` — styles stay

---

## 9. Dependencies

### New npm packages
- `bullmq` — job queue (uses existing Redis)

### Infrastructure
- Redis (already have)
- k3s worker deployment for BullMQ consumer

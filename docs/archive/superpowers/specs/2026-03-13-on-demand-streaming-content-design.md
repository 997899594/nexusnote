# On-Demand Streaming Content Generation Design

## Problem

After the interview produces a course outline (`courseSessions.outlineData`), the learning page (`/learn/[id]`) is an empty shell. Chapter documents exist as placeholders ("本章节内容生成中...") but no actual content is ever generated. Users see empty content and have no way to interact with AI while learning.

## Solution

Two-channel architecture for the learning page:

1. **Content Generation Channel**: Dedicated API route that streams chapter content on-demand when users navigate to a chapter.
2. **AI Chat Channel**: Full chat panel on the right side, reusing existing `useChat` infrastructure, scoped to the current chapter and course.

## Requirements

- **On-demand**: Content generates only when user clicks a chapter (lazy loading)
- **Streaming**: Content streams in real-time as Markdown via `StreamdownMessage`
- **Editable after generation**: Read-only during streaming, editable once complete
- **Full teaching content**: 2000-4000 characters per chapter, universal (not code-specific)
- **AI chat**: Right-side panel with full chat, RAG access, chapter-scoped context
- **No regeneration** in MVP
- **Persist**: Generated content saved to `documents` table as Tiptap JSON

## Architecture

### Page Layout (Three-Column)

```
┌──────────┬────────────────────────────┬──────────────┐
│ Sidebar  │     Chapter Content        │  AI Chat     │
│ 320px    │     flex-1                 │  400px       │
│          │                            │  Collapsible │
│ Chapters │  Streaming / Editable      │  Per-chapter │
│ Progress │  StreamdownMessage / Editor │  RAG access  │
└──────────┴────────────────────────────┴──────────────┘
```

- Zen mode hides sidebar and chat panel
- Chat panel collapsible via toggle button
- Mobile: chat panel hidden by default

### Content Generation Pipeline

#### Flow

```
User clicks chapter
  → Check chapterDocs for existing content
  → If exists: display directly (Editor, editable)
  → If not: trigger generation

Generation:
  → POST /api/learn/generate { courseId, chapterIndex }
  → Backend: auth → load outlineData → streamText(proModel)
  → Stream Markdown text via SSE
  → Frontend: StreamdownMessage renders progressively (read-only)
  → On stream complete:
      Backend: convert Markdown → Tiptap JSON → INSERT documents
      Frontend: switch to Editor (editable mode)
```

#### API Route: `POST /api/learn/generate`

**Request**:
```typescript
{ courseId: string, chapterIndex: number }
```

**Backend logic**:
1. Auth validation (user owns this course)
2. Load `courseSessions.outlineData` for full outline context
3. Check if document already exists for this chapter → return existing content if so
4. Build prompt: course overview + chapter details + teaching guidelines
5. `streamText()` with `aiProvider.proModel` + `smoothStream()` (Chinese segmentation)
6. On finish: convert Markdown to Tiptap JSON, INSERT into `documents` table
7. Return `X-Document-Id` header for frontend to track

**Prompt structure**:
```
You are a course content creator. Generate comprehensive teaching content for:
Course: {title}
Chapter {index}: {chapterTitle}
Topics: {topics}
Target audience: {targetAudience}
Difficulty: {difficulty}

Full outline for context: {outline summary}

Guidelines:
- Write in Chinese
- 2000-4000 characters
- Include: concept explanations, examples, key takeaways
- Universal learning content (not code-specific unless the topic is programming)
- Use Markdown formatting (headings, lists, bold, etc.)
```

#### Frontend Hook: `useChapterGeneration`

```typescript
interface UseChapterGenerationOptions {
  courseId: string;
  chapterIndex: number;
  enabled: boolean; // true when chapter has no content
}

interface UseChapterGenerationReturn {
  streamingContent: string;  // Accumulated markdown text
  isGenerating: boolean;
  isComplete: boolean;
  documentId: string | null; // Set after persist
  error: string | null;
}
```

Implementation:
- `fetch()` + `ReadableStream` to consume SSE
- Accumulate text chunks into state
- On stream end: emit `isComplete=true`
- Abort controller for cleanup on unmount/chapter switch

#### Duplicate Prevention

- **Backend**: Check `documents` WHERE `courseId + outlineNodeId` exists → return 200 with existing content (non-streaming)
- **Frontend**: `chapterDocs` already loaded → skip generation call

### AI Chat Panel

#### Reuse Strategy

Reuse existing chat infrastructure entirely:

- `useChat` + `DefaultChatTransport` from `@ai-sdk/react`
- Route: `/api/chat` (existing endpoint)
- Body includes: `{ sessionId, courseContext: { courseId, chapterIndex, chapterTitle } }`
- Backend injects chapter context into system prompt
- Tools: `searchNotes` + `rag` + `webSearch` + `enhance` (standard chat tools)

#### Session Management

Session ID convention:
```
learn-{courseId}-ch{chapterIndex}
```

Example: `learn-abc123-ch0`, `learn-abc123-ch1`

Each chapter has an independent conversation. Switching chapters switches `sessionId`, triggering `useChatSession` to load corresponding history.

#### UI Components

```
┌─────────────────────┐
│  AI 学习助手   [×]   │  ← Title bar + collapse button
├─────────────────────┤
│                     │
│  Message list       │  ← StreamdownMessage rendering
│                     │
├─────────────────────┤
│  [Input]     [Send] │  ← Compact input area
└─────────────────────┘
```

### Data Model

**No new tables needed.** Reuse existing schema:

| Table | Usage | Changes |
|-------|-------|---------|
| `courseSessions` | Course metadata + outline | None |
| `documents` | Chapter content (type=`course_chapter`) | Content populated by generation |
| `conversations` | Chat history per chapter | Via sessionId naming convention |

### Content Format Flow

```
AI generates → Markdown text (streamed)
           → StreamdownMessage renders (during streaming)
           → Markdown → Tiptap JSON conversion (on complete)
           → documents.content = Buffer(Tiptap JSON) (persisted)
           → Editor component displays (editable)
```

### Error Handling

- **Generation fails mid-stream**: Show error toast, allow retry by re-clicking chapter
- **Network disconnect**: Abort stream, show reconnect option
- **Duplicate generation**: Backend idempotency check prevents double-generation

## Files to Create/Modify

### New Files
- `app/api/learn/generate/route.ts` — Content generation API
- `hooks/useChapterGeneration.ts` — Streaming content hook
- `app/learn/[id]/components/LearnChat.tsx` — AI chat panel component
- `app/learn/[id]/components/ChapterContent.tsx` — Content display (streaming + editor)
- `lib/ai/prompts/learn.ts` — Content generation prompt

### Modified Files
- `app/learn/[id]/LearnClient.tsx` — Three-column layout
- `app/learn/[id]/components/LearnEditor.tsx` — Integrate with streaming state
- `stores/learn.ts` — Add generation state, chat panel visibility
- `app/learn/[id]/components/ZenModeToggle.tsx` — Hide chat panel in zen mode

### Unchanged Files
- `app/learn/[id]/page.tsx` — Server data fetching stays the same
- `app/learn/[id]/components/LearnSidebar.tsx` — No changes needed
- `app/learn/[id]/components/ChapterList.tsx` — No changes needed

## Out of Scope (MVP)

- Regeneration of chapter content
- Batch/background pre-generation
- Progress persistence to database
- Chapter locking
- Content export

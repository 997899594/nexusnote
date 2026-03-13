# Section-Based Learning Page Redesign

## Problem

The current learning page generates content at the chapter level (one 2000-4000 char block per chapter), losing the granularity of sections/topics within each chapter. Content is rendered in an editable Tiptap Editor, but users need a read-only learning experience with interactive features (highlights, notes). The outline's `topics: string[]` is too flat to drive section-level content generation.

## Solution

Redesign the learning page around section-level content:

1. **Upgrade outline schema**: `topics: string[]` → `sections: Section[]` with title + description
2. **Section-level generation**: Each section gets its own 500-1500 char content, generated on-demand with prefetching
3. **Read-only reader**: Replace editable Editor with `StreamdownMessage`-based reader + annotation layer
4. **Inline annotations**: Kindle-style text selection → highlight/note, persisted in `documents.metadata`
5. **Two-level navigation**: Chapter > Section hierarchy in sidebar with scroll-to-anchor navigation

## Requirements

- **Section granularity**: Each section in the outline gets its own document and content generation
- **Read-only**: Content is never editable as text; interaction is via highlights and notes only
- **Inline highlights**: Select text → floating toolbar → highlight with color
- **Inline notes**: Select text → floating toolbar → add note anchored to selection
- **Mixed navigation**: Chapter view scrolls through all sections; sidebar click jumps to section anchor
- **Prefetch**: After current section completes, auto-generate next section (serial, one at a time)
- **Streaming**: Content streams as Markdown via `StreamdownMessage` during generation
- **Persist**: Each section saved to `documents` table as raw Markdown; annotations saved to `documents.metadata`
- **No backward compatibility**: Old `topics: string[]` courses are not supported

## Architecture

### Outline Schema Upgrade

```typescript
// stores/interview.ts
interface Section {
  title: string;        // e.g., "变量与常量"
  description: string;  // e.g., "理解 Python 中变量的声明、赋值和命名规范"
}

interface Chapter {
  title: string;
  description: string;
  sections: Section[];           // replaces topics: string[]
  estimatedMinutes?: number;
  practiceType?: "exercise" | "project" | "quiz" | "none";
}

interface OutlineData {
  title: string;
  description: string;
  targetAudience: string;
  prerequisites?: string[];
  estimatedHours: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  chapters: Chapter[];
  learningOutcome: string;
}
```

**`outlineNodeId` convention**:
- Old: `chapter-1`, `chapter-2`
- New: `section-{chapterIndex+1}-{sectionIndex+1}` (e.g., `section-1-1`, `section-1-2`, `section-2-1`)

**`documents.type` value**:
- Old: `course_chapter`
- New: `course_section`

**Known limitation**: Sections are identified by positional index (chapter + section index). If an outline is regenerated with reordered or inserted sections, existing section documents and their annotations become mismatched. Outline regeneration is out of scope for MVP.

### Page Layout

```
┌──────────┬────────────────────────────┬──────────────┐
│ Sidebar  │     Section Content        │  AI Chat     │
│ 320px    │     flex-1                 │  400px       │
│          │                            │  Collapsible │
│ Ch > Sec │  ScrollView of sections    │  Per-chapter │
│ 2-level  │  StreamdownMessage (r/o)   │  RAG access  │
│ Progress │  + AnnotationLayer         │              │
└──────────┴────────────────────────────┴──────────────┘
```

### Sidebar Two-Level Navigation

```
▼ 第1章 基础语法
  ● 1.1 变量与常量       ← complete (solid dot)
  ● 1.2 数据类型         ← generating (pulse animation)
  ○ 1.3 运算符           ← not generated (hollow dot)

▶ 第2章 流程控制          ← collapsed
▶ 第3章 函数

──────────────────
进度 2/12 节              ← section-level progress
```

**Interactions:**
- Click chapter title → expand/collapse section list + switch content area to that chapter
- Click section → `scrollIntoView` to section anchor in content area
- Currently visible section highlighted in sidebar (driven by Intersection Observer)
- Progress counted by sections (documents with non-null content / total sections)

### Content Rendering: SectionReader

Each section rendered as a read-only block within a scrollable chapter view:

```
┌─────────────────────────────────────┐
│ ## 1.1 变量与常量                     │  ← section title (anchor id)
│                                     │
│ StreamdownMessage renders Markdown  │  ← read-only rich content
│                                     │
│ [user selects text] → floating bar  │
│   [Highlight] [Add Note]            │  ← TextSelectionToolbar
│                                     │
│ > 💡 My note: watch out for scope   │  ← inline note (anchored)
│                                     │
│ ─────────────────────────────────── │  ← section divider
│ ## 1.2 数据类型                      │
│ ⏳ Generating...                    │  ← next section prefetching
└─────────────────────────────────────┘
```

**Core behavior:**
- Content rendered with `StreamdownMessage` accepting raw Markdown
- During streaming: `StreamdownMessage` with `isStreaming={true}`, annotations disabled
- After completion: `StreamdownMessage` with `isStreaming={false}`, annotations enabled
- Sections separated by dividers, each with `id` anchor for sidebar navigation
- Intersection Observer detects which section is visible → updates `currentSectionIndex` in store → sidebar highlights
- Scroll to ungenerated section triggers generation (fallback if prefetch hasn't reached it)

### Annotation System

**Annotations are only available on completed sections** (status = `complete`). During streaming, the text selection toolbar does not appear.

**TextSelectionToolbar**: Floating toolbar on text selection:
- Appears above selected text (only in completed sections)
- Two actions: Highlight (with color picker) and Add Note
- Disappears on click outside or selection change

**AnnotationLayer**: Renders highlights and notes over completed section content:
- Highlights: `<mark>` background color on matched text ranges
- Notes: highlight + small icon in margin, hover/click expands note content
- Positioned relative to the section's container div using text-based matching

**Data storage** in `documents.metadata` jsonb (per-section document):

```typescript
{
  annotations: [
    {
      id: string;
      type: "highlight" | "note";
      anchor: {
        textContent: string;    // surrounding text for matching
        startOffset: number;    // char offset within textContent
        endOffset: number;
      };
      color?: string;           // highlight color (default yellow)
      noteContent?: string;     // note text (type=note only)
      createdAt: string;
    }
  ]
}
```

Text-based anchoring (not DOM position) ensures annotations survive re-renders. The `textContent` field stores ~50 chars surrounding the selection for fuzzy matching.

**useAnnotations hook**: CRUD for annotations with auto-save to `documents.metadata` via PATCH API.

**Annotation API Route**: `PATCH /api/learn/annotations`

```typescript
// Request
{
  documentId: string;           // section document ID
  annotations: Annotation[];   // full replacement of annotations array
}

// Response: 200
{ success: true }

// Errors: 401 (not logged in), 404 (document not found or not owned by user)
```

Backend logic:
1. Auth validation
2. Verify document exists and belongs to the user's course
3. `db.update(documents).set({ metadata: { annotations } }).where(eq(documents.id, documentId))`

The hook sends the full `annotations` array on every change (debounced 500ms). No partial updates — the array is small enough (typically <50 annotations per section) that full replacement is simpler and avoids merge conflicts.

### Section Generation Pipeline

**Content storage format**: Raw Markdown stored in `documents.content` (as `Buffer`), NOT HTML. `StreamdownMessage` accepts Markdown directly, so no conversion is needed for display. `documents.plainText` stores the same Markdown as plain text for search/RAG indexing.

**API route**: `POST /api/learn/generate`

Request changes:
```typescript
{ courseId: string, chapterIndex: number, sectionIndex: number }
```

**Backend logic changes:**
1. Validate `sectionIndex` against `outline.chapters[chapterIndex].sections[sectionIndex]`
2. `outlineNodeId` = `section-{chapterIndex+1}-{sectionIndex+1}`
3. Check existing document by `(courseId, outlineNodeId)` — return existing Markdown if found
4. `streamText()` with `buildSectionPrompt` + `smoothStream`
5. `onFinish`: store raw Markdown as `Buffer` in `documents.content` (no `marked.parse()`)

**Prompt**: `buildSectionPrompt` replaces `buildChapterPrompt`:
- Course info + chapter title/description + section title/description
- Sibling section titles for context (what comes before/after)
- 500-1500 chars, focused on single knowledge point
- Markdown format, Chinese

**Prefetch strategy**:
1. User clicks chapter → first ungenerated section starts generating
2. Current section completes → auto-trigger next section in same chapter
3. Only one generation request in-flight at a time (serial)
4. User scrolls to an ungenerated section while prefetch is in progress → let current generation finish, then prioritize the visible section next (no abort, no partial content discard)

**useChapterSections hook**:

```typescript
interface SectionState {
  content: string;      // raw markdown content (same as stored in documents.content)
  status: 'idle' | 'generating' | 'complete' | 'error';
  documentId?: string;
}

interface UseChapterSectionsReturn {
  sections: Map<number, SectionState>;   // sectionIndex → state
  currentGenerating: number | null;
  generateSection: (sectionIndex: number) => void;
  scrollToSection: (sectionIndex: number) => void;
}
```

### Document Creation on Outline Confirmation

Placeholder documents are created inside the `confirmOutline` tool's `execute` function (`lib/ai/tools/interview/index.ts`), right after the outline is saved to `courseSessions`. This is the correct location because:
- The interview route creates the `courseSessions` row (empty outline)
- `confirmOutline` updates `outlineData` on that row
- `app/api/courses/generate/route.ts` is a separate legacy flow (creates a NEW course + documents), not used by the interview path

**Eager creation**: After saving the outline, delete any existing section documents for this course, then create one placeholder document per section:

```typescript
// Inside confirmOutline execute, after db.update(courseSessions):

// Clear old section documents (supports outline re-confirmation during interview)
await db.delete(documents).where(
  and(eq(documents.courseId, courseId), eq(documents.type, "course_section"))
);

// Create placeholder per section
for (let chIdx = 0; chIdx < outline.chapters.length; chIdx++) {
  const chapter = outline.chapters[chIdx];
  for (let secIdx = 0; secIdx < chapter.sections.length; secIdx++) {
    const section = chapter.sections[secIdx];
    await db.insert(documents).values({
      type: "course_section",
      title: section.title,
      courseId: courseId,
      outlineNodeId: `section-${chIdx + 1}-${secIdx + 1}`,
      content: null,    // placeholder, content generated on-demand
      plainText: null,
    }).onConflictDoNothing();
  }
}
```

This ensures `page.tsx` can query all section documents upfront to determine which have content. The `onConflictDoNothing()` guards against race conditions from concurrent requests.

### Server-to-Client Data Contract

**`app/learn/[id]/page.tsx`** server component queries:

```typescript
// 1. Load course session + outlineData
const courseSession = await db.select()...

// 2. Extract structured chapters with sections from outlineData
const outlineData = courseSession.outlineData as OutlineData;
const chapters = outlineData.chapters.map((ch, chIdx) => ({
  title: ch.title,
  description: ch.description,
  sections: ch.sections.map((sec, secIdx) => ({
    title: sec.title,
    description: sec.description,
    nodeId: `section-${chIdx + 1}-${secIdx + 1}`,
  })),
}));

// 3. Load all section documents for this course
const sectionDocs = await db.select({
  id: documents.id,
  title: documents.title,
  content: documents.content,
  outlineNodeId: documents.outlineNodeId,
  metadata: documents.metadata,
}).from(documents).where(
  and(eq(documents.courseId, sessionId), eq(documents.type, "course_section"))
);
```

**New `LearnClientProps`**:

```typescript
interface SectionOutline {
  title: string;
  description: string;
  nodeId: string;       // e.g., "section-1-1"
}

interface ChapterOutline {
  title: string;
  description: string;
  sections: SectionOutline[];
}

interface SectionDoc {
  id: string;
  title: string | null;
  content: string | null;     // raw Markdown string or null (placeholder)
  outlineNodeId: string | null;
  metadata: { annotations?: Annotation[] } | null;
}

interface LearnClientProps {
  sessionId: string;
  courseTitle: string;
  chapters: ChapterOutline[];
  sectionDocs: SectionDoc[];        // content decoded to string before RSC boundary
  initialChapterIndex: number;
  initialCompletedSections: string[];  // computed from sectionDocs (non-null content)
}
```

### Section Progress Persistence

Section completion is **derived from documents**, not stored separately:
- A section is "complete" when its `documents.content` is non-null
- `page.tsx` computes `initialCompletedSections` from `sectionDocs` at load time: filter docs with non-null content, extract `outlineNodeId`, pass as `string[]`
- No change to `courseSessions.progress` schema — section completion is a function of document existence
- The Zustand store's `completedSections` is initialized from `initialCompletedSections` and updated client-side as generation completes

### RSC Boundary: Buffer Decoding

`documents.content` is stored as `bytea` (Node.js `Buffer`). Before passing through the React Server Component → Client Component boundary, `page.tsx` must decode `Buffer` to `string`:

```typescript
const sectionDocs = rawDocs.map(doc => ({
  ...doc,
  content: doc.content ? Buffer.from(doc.content).toString('utf-8') : null,
}));
```

This ensures `SectionDoc.content` is `string | null` on the client, avoiding `Buffer` serialization issues.

### Store Changes (stores/learn.ts)

```typescript
// New/changed fields
currentSectionIndex: number;             // within-chapter index, reset to 0 on chapter change
setCurrentSectionIndex: (index: number) => void;

completedSections: Set<string>;          // "1-1", "1-2" format (chIdx-secIdx, 0-indexed)
markSectionComplete: (key: string) => void;

expandedChapters: Set<number>;           // which chapters are expanded in sidebar
toggleChapterExpanded: (index: number) => void;

// Relationship between chapter and section index:
// - currentChapterIndex: which chapter is displayed in content area
// - currentSectionIndex: which section is currently visible (driven by Intersection Observer)
// - When user clicks a new chapter: currentSectionIndex resets to 0

// Removed
// generatedChapters — replaced by section-level tracking in hook
// isChatOpen, toggleChat, setChatOpen — already exists, unchanged
```

### Error Handling

- **Section generation fails**: Show error inline in that section, allow retry by clicking
- **Prefetch fails**: Silent retry on next trigger, don't block current section
- **Annotation save fails**: Toast error, keep annotation in local state, retry on next action

## Files to Create/Modify

### Modified Files
- `stores/interview.ts` — Section type, Chapter.sections replaces Chapter.topics
- `lib/ai/tools/interview/index.ts` — ConfirmOutlineSchema: `sections` array with `{title, description}` + eager placeholder document creation
- `lib/ai/prompts/interview.ts` — Guide AI to generate structured sections with descriptions
- `components/interview/OutlinePanel.tsx` — Display section title + description (replaces topic tags)
- `app/api/learn/generate/route.ts` — Accept `sectionIndex`, use `buildSectionPrompt`, store raw Markdown
- `lib/ai/prompts/learn.ts` — `buildSectionPrompt` replaces `buildChapterPrompt`
- `app/learn/[id]/page.tsx` — Extract chapter > section structure, query `course_section` documents
- `app/learn/[id]/LearnClient.tsx` — New `LearnClientProps` with `ChapterOutline[]` + `SectionDoc[]`
- `app/learn/[id]/components/LearnSidebar.tsx` — Two-level chapter > section navigation
- `app/learn/[id]/components/ChapterList.tsx` — Chapter > Section expandable list with status indicators
- `stores/learn.ts` — `currentSectionIndex`, `completedSections`, `expandedChapters`

### Deleted Files
- `app/learn/[id]/components/ChapterContent.tsx` — Replaced by SectionReader
- `hooks/useChapterGeneration.ts` — Replaced by useChapterSections

### New Files
- `hooks/useChapterSections.ts` — Multi-section generation + prefetch management
- `hooks/useAnnotations.ts` — Highlight/note CRUD + persistence via PATCH API
- `app/api/learn/annotations/route.ts` — PATCH endpoint for annotation persistence
- `app/learn/[id]/components/SectionReader.tsx` — Read-only section renderer with StreamdownMessage
- `app/learn/[id]/components/TextSelectionToolbar.tsx` — Floating highlight/note toolbar (completed sections only)
- `app/learn/[id]/components/AnnotationLayer.tsx` — Highlight/note rendering overlay

### Unchanged Files
- `app/learn/[id]/components/LearnChat.tsx` — AI chat panel unchanged
- `app/learn/[id]/components/ZenModeToggle.tsx` — Zen mode unchanged
- `db/schema.ts` — No table changes needed (uses existing `documents.metadata` jsonb)

## Out of Scope (MVP)

- Regeneration of section content
- Export/print course content
- Section reordering / outline re-generation
- Collaborative annotations
- Annotation search/filter
- Note color customization (only highlight has color)
- Offline annotation sync
- Backward compatibility with old `topics: string[]` courses

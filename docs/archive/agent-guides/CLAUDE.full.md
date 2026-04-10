# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

NexusNote is an AI-native knowledge management system with real-time collaboration. It combines:
- **Multi-model AI**: Gemini 3 (via 302.ai) for chat/reasoning, BGE/Baai for embeddings
- **RAG System**: Vector search with pgvector, semantic chunking, reranking
- **Real-time Collaboration**: Tiptap editor with Yjs CRDT (via PartyKit)
- **Learning System**: FSRS-5 spaced repetition, AI-generated courses
- **Personalization**: Style analysis, emotion detection, AI personas
- **Offline-First**: IndexedDB sync, works without internet

**Tech Stack**: Next.js 16, React 19, AI SDK v6, Drizzle ORM, PostgreSQL 16 + pgvector, Redis 7

---

## Development Commands

```bash
# Core development
bun dev              # Start dev server with Turbo (port 3000)
bun run build        # Production build (requires SKIP_ENV_VALIDATION=true in CI)
bun run lint         # Biome linter check (not ESLint)
bun run lint --write # Biome auto-fix
bun run typecheck    # TypeScript check without emitting

# Database operations
bun run db:migrate   # Apply versioned migrations
bun run db:studio    # Open Drizzle Studio
bun run db:generate  # Generate migration files

# Collaboration server (PartyKit)
bunx partykit dev    # Start local PartyKit server

# Environment setup
cp .env.example .env  # Configure environment variables
```

**Note**: This project has no automated tests yet. Testing infrastructure is planned.

**Package Manager**: Uses `bun` (not pnpm, despite docs mentioning pnpm)

**Services Access**:
- Web App: http://localhost:3000
- PostgreSQL: localhost:5433
- Redis: localhost:6380

---

## Architecture

### Hybrid Rendering Strategy

| Component Type | Use Case | Example |
|----------------|----------|---------|
| Server Component | Data fetching, auth, initial render | `app/learn/[id]/page.tsx` |
| Client Component | Interactions, state, animations | `components/editor/Editor.tsx` |
| Server Action | Non-streaming data mutations | `actions.tsx` files |
| Route Handler | Streaming AI responses | `app/api/chat/route.ts` |

**Pattern**: Server fetches data → passes to Client → Client handles interactions

### AI System Architecture

**Model Strategy** (via `lib/ai/core.ts`):
- **chatModel**: Gemini 3 Flash for general conversations
- **proModel**: Gemini 3 Pro for complex tasks
- **webSearchModel**: Model with web search capabilities
- **embeddingModel**: BAAI/bge-base-zh-v1.5 for text embeddings

**CircuitBreaker Pattern**: Three-state circuit breaker (closed → open → half-open) for automatic provider failover. Fallback providers: DeepSeek V3, OpenAI.

**AI SDK v6 Patterns**:
- `ToolLoopAgent` for structured AI agents with tool calling
- `streamText()` for streaming responses with tools
- `smoothStream()` with `Intl.Segmenter` for Chinese word boundaries
- `safeGenerateObject()` for schema-validated structured output with retry
- Temperature varies by task: Router (0.0), Interview (0.2), Chat (0.7)

**Agent System** (`lib/ai/agents/index.ts`):
```typescript
new ToolLoopAgent({
  id: "nexusnote-chat",
  model: aiProvider.chatModel,
  instructions: "...",
  tools: chatTools,
  stopWhen: stepCountIs(20),
})
```

**Chat API Flow** (`app/api/chat/route.ts`):
1. Auth validation → 2. Rate limiting (100 req/min per user) → 3. Request validation (Zod)
4. Load personalization (persona, user context, emotion detection)
5. Session upsert → 6. Agent selection based on intent → 7. Stream response → 8. Usage tracking

**Key Files**:
- `lib/ai/core.ts` - AIProvider singleton with CircuitBreaker, PromptRegistry
- `lib/ai/agents/` - ToolLoopAgent definitions for different intents
- `lib/ai/tools/` - All AI tool definitions (chat, learning, RAG, editor)
- `lib/ai/personas/` - AI personality system
- `app/api/chat/route.ts` - Main chat endpoint with streaming

### Personalization Layer

The system personalizes AI responses based on user context:

- `lib/memory/` - User context building from style analysis and history
- `lib/emotion/` - Emotion detection from user messages
- `lib/style/` - Writing style analysis (Big Five personality, communication style)
- `lib/ai/personas/` - Explicit persona selection

**Flow**: User message → Emotion detection → Load user context → Build personalized prompt

### Database Schema

**ORM**: Drizzle with PostgreSQL 16 + pgvector

**Key Tables**:
- `users`, `user_profiles` - User data + style analysis (Big Five, communication style)
- `documents`, `document_snapshots` - Rich text documents with versioning
- `conversations` - Chat sessions with message history
- `knowledge_chunks` - Unified RAG index (supports: document, conversation, note, course, flashcard)
- `personas` - AI personality definitions
- `course_profiles` - AI-generated learning courses
- `tags`, `document_tags` - Tagging system with embeddings
- `skills`, `skill_relationships`, `user_skill_mastery` - Skill graph for learning paths
- `ai_usage` - Token/cost tracking

**Vector Search**: Uses `halfvec(4000)` for 50% storage savings (requires pgvector 0.5.0+)

### Real-time Collaboration

**Stack**: Tiptap v3 + Yjs + PartyKit

**Architecture**:
- `party/server.ts` - PartyKit server for Yjs synchronization
- `components/editor/CollaborationEditor.tsx` - Main collaborative editor
- `lib/tiptap/` - Tiptap extensions and configuration

**Data Flow**: Yjs CRDT → PartyKit WebSocket → Automatic sync across clients

### RAG Pipeline

Located in `lib/rag/`:

- `semantic-chunker.ts` - Intelligent content chunking
- `hybrid-search.ts` - Vector + keyword search
- `query-rewriter.ts` - Query enhancement (optional, flag-controlled)

### Interview System

Uses FSM (Finite State Machine) pattern for structured interview flows:

- `app/interview/` - Interview page routes
- Interview state machine manages conversation phases
- Lower temperature (0.2) for consistent interview behavior

### Skill Graph System

Located in `lib/skills/`:

- Skill discovery from user content
- Skill relationships and prerequisites
- User mastery tracking with `user_skill_mastery` table

---

## Configuration

**Environment Config**: `config/env.ts`

**Critical Variables**:
```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/nexusnote

# AI Provider (at least one required)
AI_302_API_KEY=sk-xxx         # Primary (Gemini 3)
DEEPSEEK_API_KEY=sk-xxx       # Fallback

# Auth
AUTH_SECRET=<32+ chars>       # NextAuth secret
JWT_SECRET=<32+ chars>

# Optional Features
AI_ENABLE_WEB_SEARCH=false    # Enable web search capability
RERANKER_ENABLED=false        # Enable reranker for RAG
```

**Config Pattern**: Proxy-based lazy initialization for both server (`env`) and client (`clientEnv`) environments.

**AI Observability** (optional): Set `LANGFUSE_PUBLIC_KEY` and `LANGFUSE_SECRET_KEY` to enable AI call tracing (tokens, cost, latency, tool calls).

---

## Component Patterns

### UI Components (`components/ui/`)

Base UI components using Radix UI primitives + Tailwind:
- `Button.tsx` - with `cn()` for variant merging
- `Tooltip.tsx`, `Separator.tsx`, `Toast.tsx`

### Editor Components (`components/editor/`)

- `Editor.tsx` - Main Tiptap editor client component
- `CollaborationEditor.tsx` - Wraps editor with Yjs sync
- `AIMenu.tsx` - AI-powered slash commands
- `AISuggestions.tsx` - Inline AI suggestions

### Chat Components (`components/chat/`)

- `ChatPanel.tsx` - Main chat interface
- `StreamdownMessage.tsx` - Streaming markdown renderer
- `PersonaSelector.tsx` - AI personality switcher

### Tags Components (`components/tags/`)

- `TagBar.tsx` - Tag display and management
- `TagGenerationTrigger.tsx` - AI-powered tag generation
- `PendingTagsPopover.tsx` - Review pending tags

### Layout Components (`components/shared/layout/`)

- `AppSidebar.tsx` - Main navigation sidebar
- `ResponsiveContainer.tsx` - Mobile-responsive layout wrapper
- `MobileNav.tsx`, `DrawerMenu.tsx` - Mobile navigation

---

## State Management

**Zustand Stores** (`stores/`):

- `stores/chat.ts` - Chat session list management
- `stores/editor.ts` - Editor state
- `stores/auth.ts` - Authentication state

**Pattern**: Lightweight global state with Zustand, local state with React hooks. React Compiler handles optimization automatically.

---

## Important Patterns

### Code-Driven, Not Prompt-Driven

AI behavior is controlled by code logic, not prompt engineering. The system uses:
- State machines for interview flow (FSM pattern)
- `ToolLoopAgent` with explicit tool definitions
- Intent-based agent routing via `routeIntent()`
- `stopWhen: stepCountIs(N)` for controlled tool loops

### Schema-First Development

All data structures have Zod schemas:
- `config/env.ts` - Environment validation
- `lib/ai/validation.ts` - AI message validation
- Type definitions in `types/`

### Path Aliases

```typescript
"@/*"           → root directory
"@/config/*"    → config/
"@/lib/*"       → lib/
"@/components/*"→ components/
"@/types"       → types/
"@/db"          → db/
"@/db/*"        → db/*
```

### React Compiler Enabled

`next.config.js` has `reactCompiler: true`. This means:
- Automatic optimization of re-renders
- Reduced need for `useCallback`/`useMemo`
- Trust the compiler, avoid manual optimizations

### Suspense Boundaries

Use granular Suspense for progressive loading:
```tsx
<Suspense fallback={<Skeleton />}>
  <AsyncComponent />
</Suspense>
```

### Streaming Markdown

Use `StreamdownMessage` component for AI responses:
```tsx
<StreamdownMessage content={aiResponse} isStreaming={true} />
```

---

## AI Tools System

Located in `lib/ai/tools/`:

| Directory | Purpose |
|-----------|---------|
| `chat/` | Conversation tools (flashcard, search, notes, web-search) |
| `editor/` | Document editing tools (ai-editor) |
| `learning/` | Course generation, learning plans |
| `rag/` | Knowledge retrieval tools |
| `skills/` | Skill discovery and management |
| `style/` | Writing style analysis |

**Adding a Tool**: Define in appropriate directory, export from `index.ts`, register in agent configuration.

---

## Deployment

**Production**: K3s cluster with GitOps (ArgoCD)

**Process**:
1. `git push` → GitHub Actions builds & pushes to GHCR
2. ArgoCD Image Updater detects digest change
3. Automatic sync to cluster

**See**: `DEPLOYMENT.md` for full deployment guide

---

## File Structure Notes

- `app/` - Next.js App Router (routes are file-based)
- `components/` - React components organized by feature
- `lib/` - Business logic, utilities, services
- `db/` - Database schema and Drizzle config
- `stores/` - Zustand state management stores
- `types/` - TypeScript type definitions
- `config/` - Environment and configuration
- `party/` - PartyKit collaboration server
- `docs/` - Extensive documentation (AI.md, ARCHITECTURE_2026.md)
- `deploy/` - Kubernetes manifests and deployment scripts

---

## Common Gotchas

1. **Package Manager**: Use `bun`, not `pnpm` (docs may reference pnpm)
2. **Build Phase**: `SKIP_ENV_VALIDATION=true` or `NEXT_PHASE=phase-production-build` needed for builds
3. **pgvector halfvec**: Manual migration fix needed: `sed -i 's/"halfvec(4000)"/halfvec(4000)/g' drizzle/*.sql`
4. **Client Env Access**: Server env vars are proxied and throw warnings if accessed on client
5. **Chinese Streaming**: Use `smoothStream()` with `Intl.Segmenter('zh-CN')` for proper word chunking
6. **Rate Limiting**: Chat API has 100 requests/min per user limit
7. **State Management**: Uses Zustand (not Jotai, despite some docs mentioning it)
8. **Collaboration Server**: Uses PartyKit (not Hocuspocus, despite some docs mentioning it)

---

## Key Libraries

| Library | Purpose | Notes |
|---------|---------|-------|
| `@ai-sdk/react` | AI chat hooks | `useChat()` with custom transport |
| `@tiptap/react` | Rich text editor | Extensible, collaborative |
| `y-partykit` | CRDT sync | PartyKit integration for Yjs |
| `streamdown` | Streaming markdown | Optimized for real-time AI |
| `framer-motion` | Animations | Use sparingly with React Compiler |
| `drizzle-orm` | Database | Type-safe SQL |
| `bullmq` | Job queue | For RAG indexing |
| `zustand` | State management | Lightweight global state |
| `zod` | Validation | Schema-first development |

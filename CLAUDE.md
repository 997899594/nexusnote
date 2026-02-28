# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

NexusNote is an AI-native knowledge management system with real-time collaboration. It combines:
- **Multi-model AI**: Gemini 3 (via 302.ai) for chat/reasoning, Qwen3 for embeddings
- **RAG System**: Vector search with pgvector, semantic chunking, reranking
- **Real-time Collaboration**: Tiptap editor with Yjs CRDT (via PartyKit)
- **Learning System**: FSRS-5 spaced repetition, AI-generated flashcards
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
bun run db:push      # Push schema changes to database
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
- **Primary**: 302.ai Gemini 3 Flash/Pro (set `AI_302_API_KEY`)
- **Fallback**: DeepSeek V3, OpenAI (automatic degradation via CircuitBreaker)

**AI SDK v6 Patterns**:
- `streamText()` for streaming responses with tools
- `smoothStream()` with `Intl.Segmenter` for Chinese word boundaries
- Tool-first generative UI: AI calls tools → frontend renders components
- Temperature varies by task: Router (0.0), Interview (0.2), Chat (0.7)

**Key Files**:
- `lib/ai/core.ts` - AIProvider singleton with CircuitBreaker
- `lib/ai/tools/` - All AI tool definitions (chat, learning, RAG, editor)
- `lib/ai/personas/` - AI personality system
- `app/api/chat/route.ts` - Main chat endpoint with streaming

### Database Schema

**ORM**: Drizzle with PostgreSQL 16 + pgvector

**Key Tables**:
- `users`, `user_profiles` - User data + style analysis (Big Five, communication style)
- `documents`, `document_snapshots` - Rich text documents with versioning
- `conversations` - Chat sessions with message history
- `knowledge_chunks` - Unified RAG index (supports: document, conversation, note, course, flashcard)
- `personas` - AI personality definitions
- `course_profiles` - AI-generated learning courses

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

**Embedding Model**: Qwen/Qwen3-Embedding-8B (4000 dimensions)

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

### Layout Components (`components/shared/layout/`)

- `AppSidebar.tsx` - Main navigation sidebar
- `ResponsiveContainer.tsx` - Mobile-responsive layout wrapper
- `MobileNav.tsx`, `DrawerMenu.tsx` - Mobile navigation

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
| `bullmq` | Job queue | For RAG indexing (when implemented) |
| `zustand` | State management | Lightweight global state |

---

## Important Patterns

### Code-Driven, Not Prompt-Driven

AI behavior is controlled by code logic, not prompt engineering. The system uses:
- State machines for interview flow (FSM pattern)
- Tool definitions for AI capabilities
- Explicit agent routing based on intent

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
- `types/` - TypeScript type definitions
- `config/` - Environment and configuration
- `docs/` - Extensive documentation (AI.md, ARCHITECTURE_2026.md)
- `deploy/` - Kubernetes manifests and deployment scripts

---

## Common Gotchas

1. **Package Manager**: Use `bun`, not `pnpm` (docs may reference pnpm)
2. **Build Phase**: `SKIP_ENV_VALIDATION=true` or `NEXT_PHASE=phase-production-build` needed for builds
3. **pgvector halfvec**: Manual migration fix needed: `sed -i 's/"halfvec(4000)"/halfvec(4000)/g' drizzle/*.sql`
4. **Client Env Access**: Server env vars are proxied and throw warnings if accessed on client
5. **Chinese Streaming**: Use `smoothStream()` with `Intl.Segmenter('zh-Hans')` for proper word chunking

# AGENTS.md - NexusNote Development Guide

This file provides guidelines for agentic coding agents working in the NexusNote codebase.

## Project Overview

NexusNote is an AI-native knowledge management system with real-time collaboration.
- **Stack**: Next.js 16, React 19, TypeScript, AI SDK v6, Drizzle ORM, PostgreSQL + pgvector
- **Package Manager**: bun (NOT pnpm or npm)
- **Linter/Formatter**: Biome

---

## Commands

### Development
```bash
bun dev              # Start dev server with Turbo (port 3000)
bun run build        # Production build
bun run start        # Start production server
bunx partykit dev    # Start local PartyKit server (real-time collaboration)
bun run db:studio    # Open Drizzle Studio (database GUI)
```

### Quality Checks
```bash
bun run lint         # Biome linter check
bun run lint --write # Biome auto-fix
bun run typecheck    # TypeScript check without emitting
```

### Database
```bash
bun run db:push      # Push schema changes to database
bun run db:generate  # Generate migration files
```

**Note**: No test framework exists yet. Testing infrastructure is planned.

---

## Code Style

### General Rules (Biome)
- **Indent**: 2 spaces (not tabs)
- **Line width**: 100 characters max
- **Quotes**: Double quotes (`"`) for strings
- **Semicolons**: Always required
- **Trailing commas**: Enabled in biome config

### Imports & Organization

**Path Aliases** (use these instead of relative paths):
```
"@/*"           → root directory
"@/config/*"    → config/
"@/lib/*"       → lib/
"@/components/*"→ components/
"@/types"       → types/
"@/db"          → db/
```

**Import Order** (Biome auto-organizes):
1. Library imports (React, Next.js, etc.)
2. Internal imports (@/libcomponents/*)
/*, @/3. Relative imports
4. Type imports (use `import type`)

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase | `ChatPanel.tsx`, `AIMenu.tsx` |
| Files (utilities) | kebab-case | `semantic-chunker.ts`, `hybrid-search.ts` |
| React Components | PascalCase | `function ChatPanel()` |
| Hooks | camelCase with `use` prefix | `useChat()`, `useAuth()` |
| Variables/Functions | camelCase | `getUserData()`, `isLoading` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT`, `MAX_RETRIES` |
| Types/Interfaces | PascalCase | `UserProfile`, `ChatMessage` |
| Database Tables | snake_case | `user_profiles`, `knowledge_chunks` |

### TypeScript Guidelines

- **Avoid `any`**: Use `unknown` or proper typing instead
- **Use Zod** for runtime validation (especially env config)
- **Explicit return types** for utility functions when not obvious
- **Use `interface`** for object shapes, `type` for unions/intersections
- **Non-null assertions**: Avoid `!` operator; use proper null checks

### React Patterns

- **Server vs Client Components**: Default to Server; use `"use client"` only when needed (interactions, state, animations)
- **Server Actions** for non-streaming mutations
- **Route Handlers** for streaming AI responses
- **Granular Suspense**: Use Suspense boundaries for progressive loading
- **React Compiler**: Enabled in next.config.js - trust it, avoid manual `useCallback`/`useMemo`

### Error Handling

- Use try/catch with specific error types
- Prefer typed error objects over generic Error
- Log errors with context (use structured logging)
- Never expose raw error messages to clients

### Database (Drizzle ORM)

- Use `drizzle-orm` for all database operations
- Schema in `db/schema/`
- Migrations via `bun run db:generate` and `bun run db:push`
- Use `zod` schemas alongside Drizzle for validation
- Vector search uses `halfvec(4000)` (requires pgvector 0.5.0+)

### AI System

- All AI tools in `lib/ai/tools/`
- Use `streamText()` for streaming responses
- Use `smoothStream()` with `Intl.Segmenter('zh-Hans')` for Chinese text
- Tool-first generative UI: AI calls tools → frontend renders components
- **Code-driven, NOT prompt-driven**: Control AI behavior through code logic, not prompts

### UI Components

- Base components in `components/ui/` using Radix UI + Tailwind
- Use `cn()` utility (clsx + tailwind-merge) for variant merging
- Editor components in `components/editor/` (Tiptap-based)
- Chat components in `components/chat/`

### Git Conventions

- Commit messages: Imperative mood ("add feature" not "added feature")
- Keep commits atomic and focused
- Never commit secrets or `.env` files

---

## Common Gotchas

1. **Package Manager**: Always use `bun`, not pnpm
2. **Build Phase**: Set `SKIP_ENV_VALIDATION=true` or `NEXT_PHASE=phase-production-build` for builds
3. **pgvector halfvec**: Manual migration fix needed if schema uses `"halfvec(4000)"` (quotes cause issues)
4. **Client Env**: Server env vars are proxied via `config/env.ts`; accessing them directly on client throws warnings
5. **Chinese Streaming**: Always use `smoothStream()` with `Intl.Segmenter` for proper Chinese word boundaries

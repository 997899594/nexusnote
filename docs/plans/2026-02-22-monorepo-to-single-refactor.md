# NexusNote Monorepo to Single Project Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove monorepo structure and consolidate all code into a single `web/` project to prevent AI from ignoring packages during development.

**Architecture:** Move all packages into the web project as internal directories, update all imports from workspace dependencies to path aliases, remove Turbo/pnpm workspace configuration.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, pnpm, existing AI SDK integration

---

## Current State Analysis

**Workspace packages to migrate:**
| Package | Destination | Files |
|---------|-------------|-------|
| `@nexusnote/config` | `web/config/env.ts` | 1 file (~390 lines) |
| `@nexusnote/db` | `web/db/` | 3 files (schema, index, fsrs) |
| `@nexusnote/ai-core` | `web/lib/ai/` | 4 files |
| `@nexusnote/fsrs` | `web/lib/fsrs/` | 1 file (~290 lines) |
| `@nexusnote/types` | `web/types/` | 1 file (~238 lines) - merge with existing |
| `@nexusnote/ui` | `web/lib/ui/` | 6 files |

**Duplicate code to resolve:**
| Item | Keep | Delete |
|------|------|--------|
| FSRS algorithm | `packages/fsrs/` (pure functions) | `packages/db/src/fsrs.ts` |
| Circuit Breaker | `packages/ai-core/` | `apps/web/ui/ai/circuit-breaker.ts` |
| Intent type | `apps/web/types/` | N/A (keep current) |

**Files using workspace dependencies:** 12 files found with `@nexusnote/` imports

---

## Import Path Mapping

| Old Import | New Import |
|------------|------------|
| `@nexusnote/config` | `@/config/env` |
| `@nexusnote/db` | `@/db` |
| `@nexusnote/ai-core` | `@/lib/ai` |
| `@nexusnote/fsrs` | `@/lib/fsrs` |
| `@nexusnote/types` | `@/types` |
| `@nexusnote/ui` | `@/lib/ui` |

---

## Implementation Tasks

### Task 1: Create directory structure in web/

**Files:**
- Create: `apps/web/config/`
- Create: `apps/web/lib/ai/`
- Create: `apps/web/lib/fsrs/`
- Create: `apps/web/lib/ui/components/`
- Create: `apps/web/lib/ui/`

**Step 1: Create all required directories**

```bash
cd /Users/findbiao/projects/nexusnote/apps/web
mkdir -p config lib/ai lib/fsrs lib/ui/components
```

**Step 2: Verify directories created**

Run: `ls -la config/ lib/`
Expected: All directories exist

**Step 3: Commit**

```bash
git add apps/web/config apps/web/lib
git commit -m "feat: create directory structure for monorepo consolidation"
```

---

### Task 2: Migrate config package

**Files:**
- Create: `apps/web/config/env.ts` (from `packages/config/src/index.ts`)
- Modify: `apps/web/tsconfig.json` (add path alias)

**Step 1: Copy config file**

```bash
cp /Users/findbiao/projects/nexusnote/packages/config/src/index.ts \
   /Users/findbiao/projects/nexusnote/apps/web/config/env.ts
```

**Step 2: Add path alias to tsconfig.json**

Edit `apps/web/tsconfig.json`, add to paths:
```json
"@/config/env": ["./config/env"]
```

**Step 3: Verify file exists**

Run: `cat apps/web/config/env.ts | head -20`
Expected: File content starts with config exports

**Step 4: Commit**

```bash
git add apps/web/config apps/web/tsconfig.json
git commit -m "feat: migrate config package to web/config/env.ts"
```

---

### Task 3: Migrate ai-core package

**Files:**
- Create: `apps/web/lib/ai/circuit-breaker.ts`
- Create: `apps/web/lib/ai/prompt-registry.ts`
- Create: `apps/web/lib/ai/safe-generate.ts`
- Create: `apps/web/lib/ai/index.ts`

**Step 1: Copy ai-core files**

```bash
cp /Users/findbiao/projects/nexusnote/packages/ai-core/src/*.ts \
   /Users/findbiao/projects/nexusnote/apps/web/lib/ai/
```

**Step 2: Add path alias to tsconfig.json**

Edit `apps/web/tsconfig.json`, add to paths:
```json
"@/lib/ai": ["./lib/ai"]
```

**Step 3: Verify files copied**

Run: `ls -la apps/web/lib/ai/`
Expected: circuit-breaker.ts, index.ts, prompt-registry.ts, safe-generate.ts

**Step 4: Commit**

```bash
git add apps/web/lib/ai apps/web/tsconfig.json
git commit -m "feat: migrate ai-core package to web/lib/ai"
```

---

### Task 4: Migrate fsrs package

**Files:**
- Create: `apps/web/lib/fsrs/index.ts`

**Step 1: Copy fsrs file**

```bash
cp /Users/findbiao/projects/nexusnote/packages/fsrs/src/index.ts \
   /Users/findbiao/projects/nexusnote/apps/web/lib/fsrs/
```

**Step 2: Add path alias to tsconfig.json**

Edit `apps/web/tsconfig.json`, add to paths:
```json
"@/lib/fsrs": ["./lib/fsrs"]
```

**Step 3: Verify file exists**

Run: `wc -l apps/web/lib/fsrs/index.ts`
Expected: ~290 lines

**Step 4: Commit**

```bash
git add apps/web/lib/fsrs apps/web/tsconfig.json
git commit -m "feat: migrate fsrs package to web/lib/fsrs"
```

---

### Task 5: Migrate db package (without fsrs.ts)

**Files:**
- Create: `apps/web/db/` directory
- Create: `apps/web/db/schema.ts` (from `packages/db/src/schema.ts`)
- Create: `apps/web/db/index.ts` (from `packages/db/src/index.ts`, modified)
- Create: `apps/web/db/drizzle.config.ts` (from `packages/db/drizzle.config.ts`)

**Step 1: Create db directory and copy schema**

```bash
mkdir -p /Users/findbiao/projects/nexusnote/apps/web/db
cp /Users/findbiao/projects/nexusnote/packages/db/src/schema.ts \
   /Users/findbiao/projects/nexusnote/apps/web/db/schema.ts
cp /Users/findbiao/projects/nexusnote/packages/db/src/index.ts \
   /Users/findbiao/projects/nexusnote/apps/web/db/index.ts
cp /Users/findbiao/projects/nexusnote/packages/db/drizzle.config.ts \
   /Users/findbiao/projects/nexusnote/apps/web/db/
```

**Step 2: Remove fsrs export from db/index.ts**

Edit `apps/web/db/index.ts`:
- Remove line: `export * from "./fsrs.js";`
- Change line 1: `import { env } from "@nexusnote/config";` → `import { env } from "@/config/env";`

**Step 3: Add path alias to tsconfig.json**

Edit `apps/web/tsconfig.json`, add to paths:
```json
"@/db": ["./db"]
```

**Step 4: Verify files**

Run: `ls -la apps/web/db/`
Expected: drizzle.config.ts, index.ts, schema.ts

**Step 5: Commit**

```bash
git add apps/web/db apps/web/tsconfig.json
git commit -m "feat: migrate db package to web/db (without fsrs)"
```

---

### Task 6: Merge types package

**Files:**
- Modify: `apps/web/types/index.ts` (merge with `packages/types/src/index.ts`)

**Step 1: Read both files**

Current `apps/web/types/index.ts` contains:
- `User`, `BaseEntity`, `Intent`, `LoadingStatus`

Package `packages/types/src/index.ts` contains:
- Document types, Snapshot types, SRS/Flashcard types, Learning types, Collaboration types, RAG types, Health check types, API response types

**Step 2: Append package types to web types**

Edit `apps/web/types/index.ts`, append content from `packages/types/src/index.ts`:
```typescript
// ... existing exports ...

// ============================================
// Document & Editor Types (from @nexusnote/types)
// ============================================
export interface DocumentBlock { /* ... */ }
export interface DocumentStructure { /* ... */ }
export interface EditCommand { /* ... */ }
// ... etc for all types from packages/types
```

**Step 3: Verify no duplicates**

Check for: `CardState`, `ReviewRating`, `FSRSCard` types which may overlap with fsrs package

**Step 4: Commit**

```bash
git add apps/web/types
git commit -m "feat: merge @nexusnote/types into web/types/index.ts"
```

---

### Task 7: Migrate ui package

**Files:**
- Create: `apps/web/lib/ui/components/Button.tsx`
- Create: `apps/web/lib/ui/components/Tooltip.tsx`
- Create: `apps/web/lib/ui/components/Separator.tsx`
- Create: `apps/web/lib/ui/components/ButtonGroup.tsx`
- Create: `apps/web/lib/ui/utils.ts`
- Create: `apps/web/lib/ui/index.ts`

**Step 1: Copy UI files**

```bash
cp /Users/findbiao/projects/nexusnote/packages/ui/src/*.tsx \
   /Users/findbiao/projects/nexusnote/apps/web/lib/ui/components/
cp /Users/findbiao/projects/nexusnote/packages/ui/src/index.ts \
   /Users/findbiao/projects/nexusnote/apps/web/lib/ui/
cp /Users/findbiao/projects/nexusnote/packages/ui/src/utils.ts \
   /Users/findbiao/projects/nexusnote/apps/web/lib/ui/
```

**Step 2: Add path alias to tsconfig.json**

Edit `apps/web/tsconfig.json`, add to paths:
```json
"@/lib/ui": ["./lib/ui"]
```

**Step 3: Verify files**

Run: `ls -la apps/web/lib/ui/`
Expected: components/, index.ts, utils.ts

**Step 4: Commit**

```bash
git add apps/web/lib/ui apps/web/tsconfig.json
git commit -m "feat: migrate ui package to web/lib/ui"
```

---

### Task 8: Delete duplicate circuit-breaker

**Files:**
- Delete: `apps/web/ui/ai/circuit-breaker.ts`

**Step 1: Remove duplicate file**

```bash
rm /Users/findbiao/projects/nexusnote/apps/web/ui/ai/circuit-breaker.ts
```

**Step 2: Verify deletion**

Run: `ls apps/web/ui/ai/circuit-breaker.ts 2>&1`
Expected: "No such file or directory"

**Step 3: Commit**

```bash
git add apps/web/ui/ai/circuit-breaker.ts
git commit -m "refactor: remove duplicate circuit-breaker (use lib/ai version)"
```

---

### Task 9: Update imports in API routes

**Files:**
- Modify: `apps/web/app/api/chat/route.ts`
- Modify: `apps/web/app/api/chat-sessions/route.ts`
- Modify: `apps/web/app/api/chat-sessions/[id]/route.ts`
- Modify: `apps/web/app/api/auth/[...nextauth]/route.ts`

**Step 1: Update chat route**

Edit `apps/web/app/api/chat/route.ts`:
```typescript
// Change: import { aiUsage, conversations, db } from "@nexusnote/db";
// To: import { aiUsage, conversations, db } from "@/db";
```

**Step 2: Update chat-sessions routes**

Edit `apps/web/app/api/chat-sessions/route.ts`:
```typescript
// Change: import { conversations, db, desc, eq, sql } from "@nexusnote/db";
// To: import { conversations, db, desc, eq, sql } from "@/db";
```

Edit `apps/web/app/api/chat-sessions/[id]/route.ts`:
```typescript
// Change: import { conversations, db, eq } from "@nexusnote/db";
// To: import { conversations, db, eq } from "@/db";
```

**Step 3: Update auth route**

Check if auth route uses any workspace imports

**Step 4: Commit**

```bash
git add apps/web/app/api
git commit -m "refactor: update imports in API routes"
```

---

### Task 10: Update imports in services

**Files:**
- Modify: `apps/web/services/profile/ProfileService.ts`
- Modify: `apps/web/services/rag/chunker.ts`
- Modify: `apps/web/services/rag/hybrid-search.ts`

**Step 1: Update ProfileService**

Edit `apps/web/services/profile/ProfileService.ts`:
```typescript
// Change: import { db, userProfiles, eq } from "@nexusnote/db";
// To: import { db, userProfiles, eq } from "@/db";
```

**Step 2: Update RAG services**

Edit `apps/web/services/rag/chunker.ts`:
```typescript
// Change: import { db, documents, eq, knowledgeChunks } from "@nexusnote/db";
// To: import { db, documents, eq, knowledgeChunks } from "@/db";
```

Edit `apps/web/services/rag/hybrid-search.ts`:
```typescript
// Change: import { db, sql } from "@nexusnote/db";
// To: import { db, sql } from "@/db";
```

**Step 3: Commit**

```bash
git add apps/web/services
git commit -m "refactor: update imports in services"
```

---

### Task 11: Update imports in lib/queue

**Files:**
- Modify: `apps/web/lib/queue/queues/conversation-indexing.ts`

**Step 1: Update conversation-indexing**

Edit `apps/web/lib/queue/queues/conversation-indexing.ts`:
```typescript
// Change: import { env } from "@nexusnote/config";
// To: import { env } from "@/config/env";
```

**Step 2: Commit**

```bash
git add apps/web/lib/queue
git commit -m "refactor: update imports in lib/queue"
```

---

### Task 12: Update imports in UI components

**Files:**
- Modify: `apps/web/ui/chat/stores/useChatStore.ts`
- Modify: `apps/web/ui/chat/components/ChatHistory.tsx`
- Modify: `apps/web/ui/ai/tools/chat/flashcard.ts`
- Modify: `apps/web/ui/ai/tools/chat/notes.ts`
- Modify: `apps/web/ui/ai/tools/chat/search.ts`
- Modify: `apps/web/ui/ai/tools/learning/course.ts`

**Step 1: Update chat store**

Edit `apps/web/ui/chat/stores/useChatStore.ts`:
```typescript
// Change: import type { Conversation } from "@nexusnote/db";
// To: import type { Conversation } from "@/db";
```

**Step 2: Update chat components**

Edit `apps/web/ui/chat/components/ChatHistory.tsx`:
```typescript
// Change: import type { Conversation } from "@nexusnote/db";
// To: import type { Conversation } from "@/db";
```

**Step 3: Update AI tools**

Edit all files in `apps/web/ui/ai/tools/`:
```typescript
// Change: import { db, ... } from "@nexusnote/db";
// To: import { db, ... } from "@/db";
```

**Step 4: Commit**

```bash
git add apps/web/ui
git commit -m "refactor: update imports in UI components"
```

---

### Task 13: Update web/package.json

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Remove workspace dependencies**

Edit `apps/web/package.json`, remove from dependencies:
```json
"@nexusnote/config": "workspace:^",
"@nexusnote/db": "workspace:^",
```

**Step 2: Add direct dependencies**

Add to `dependencies`:
```json
"drizzle-orm": "^0.44.0",
"postgres": "^3.4.0",
"pgvector": "^0.2.0"
```

Add to `devDependencies` (if not present):
```json
"drizzle-kit": "^0.30.0"
```

**Step 3: Update scripts**

Add database scripts:
```json
"db:push": "drizzle-kit push",
"db:studio": "drizzle-kit studio",
"db:generate": "drizzle-kit generate"
```

**Step 4: Commit**

```bash
git add apps/web/package.json
git commit -m "refactor: update package.json - remove workspace deps"
```

---

### Task 14: Delete packages directory

**Files:**
- Delete: `packages/` directory

**Step 1: Remove all packages**

```bash
rm -rf /Users/findbiao/projects/nexusnote/packages
```

**Step 2: Verify deletion**

Run: `ls packages 2>&1`
Expected: "No such file or directory"

**Step 3: Commit**

```bash
git add packages
git commit -m "refactor: remove packages directory (migrated to web/)"
```

---

### Task 15: Delete legacy-web

**Files:**
- Delete: `apps/legacy-web/`

**Step 1: Remove legacy-web**

```bash
rm -rf /Users/findbiao/projects/nexusnote/apps/legacy-web
```

**Step 2: Verify deletion**

Run: `ls apps/`
Expected: Only `web/` directory

**Step 3: Commit**

```bash
git add apps/legacy-web
git commit -m "refactor: remove deprecated legacy-web"
```

---

### Task 16: Move web/ to root and delete apps/

**Files:**
- Move: `apps/web/` → `web/`
- Delete: `apps/` directory

**Step 1: Move web to temp location**

```bash
mv /Users/findbiao/projects/nexusnote/apps/web /tmp/web-temp
```

**Step 2: Delete apps directory**

```bash
rmdir /Users/findbiao/projects/nexusnote/apps
```

**Step 3: Move web to root**

```bash
mv /tmp/web-temp /Users/findbiao/projects/nexusnote/web
```

**Step 4: Update root package.json**

Edit `package.json` at root, change scripts:
```json
{
  "name": "nexusnote",
  "private": true,
  "scripts": {
    "dev": "cd web && pnpm dev",
    "build": "cd web && pnpm build",
    "start": "cd web && pnpm start",
    "lint": "cd web && pnpm lint",
    "typecheck": "cd web && pnpm typecheck",
    "db:push": "cd web && pnpm db:push",
    "db:studio": "cd web && pnpm db:studio",
    "db:generate": "cd web && pnpm db:generate"
  },
  "engines": {
    "node": ">=18"
  }
}
```

**Step 5: Commit**

```bash
git add apps/ web/ package.json
git commit -m "refactor: move web/ to root, remove apps/ directory"
```

---

### Task 17: Remove monorepo configuration

**Files:**
- Delete: `turbo.json`
- Delete: `pnpm-workspace.yaml`

**Step 1: Delete monorepo configs**

```bash
rm /Users/findbiao/projects/nexusnote/turbo.json
rm /Users/findbiao/projects/nexusnote/pnpm-workspace.yaml
```

**Step 2: Verify deletion**

Run: `ls turbo.json pnpm-workspace.yaml 2>&1`
Expected: "No such file or directory"

**Step 3: Update root package.json**

Remove Turbo scripts and dependencies from root `package.json`

**Step 4: Commit**

```bash
git add turbo.json pnpm-workspace.yaml package.json
git commit -m "refactor: remove monorepo configuration"
```

---

### Task 18: Verify and test

**Files:** None (verification task)

**Step 1: Clean install dependencies**

Run: `pnpm install`
Expected: No errors, all dependencies resolved

**Step 2: Type check**

Run: `cd web && pnpm typecheck`
Expected: No TypeScript errors

**Step 3: Lint**

Run: `cd web && pnpm lint`
Expected: No lint errors

**Step 4: Build**

Run: `cd web && pnpm build`
Expected: Build succeeds

**Step 5: Final commit**

```bash
git add .
git commit -m "chore: verify monorepo to single project refactor complete"
```

---

## Verification Checklist

After all tasks complete:

- [ ] No `@nexusnote/` imports remain in codebase
- [ ] All packages/ directory deleted
- [ ] apps/ directory deleted (only web/ at root)
- [ ] turbo.json deleted
- [ ] pnpm-workspace.yaml deleted
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` succeeds
- [ ] No duplicate code (fsrs, circuit-breaker)
- [ ] Database config points to correct location

---

## Final Structure

```
nexusnote/
├── web/                    ← Main project (formerly apps/web)
│   ├── app/
│   ├── config/
│   │   └── env.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts
│   │   └── drizzle.config.ts
│   ├── lib/
│   │   ├── ai/            ← from packages/ai-core
│   │   ├── fsrs/          ← from packages/fsrs
│   │   ├── queue/
│   │   └── ui/            ← from packages/ui
│   ├── types/
│   │   └── index.ts       ← merged from packages/types
│   ├── ui/                ← page components
│   ├── services/
│   ├── infrastructure/
│   ├── party/
│   └── package.json
├── deploy/                 ← K8s configs (unchanged)
├── docs/                   ← docs (unchanged)
├── package.json            ← script entry point
├── biome.json
└── .env.example
```

# Features to UI Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 features/ 目录重命名为 ui/，清理与 services/infrastructure 层的重复代码，迁移有价值的代码。

**Architecture:**
- ui/ - UI 组件层（原 features/）
- services/ - 业务逻辑层
- infrastructure/ - 基础设施层

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM, Git worktree

---

## Prerequisites

**Start from:** `main` branch
**Create worktree:** `git worktree add .worktrees/ui-refactor -b refactor/features-to-ui`

**Reference docs:**
- `docs/plans/2025-02-22-features-to-ui-refactor-design.md` - 设计文档

---

## Task 1: Create worktree and initial setup

**Step 1: Create worktree**

```bash
git worktree add .worktrees/ui-refactor -b refactor/features-to-ui
```

**Step 2: Verify worktree created**

```bash
git worktree list
```

Expected: Shows new worktree at `.worktrees/ui-refactor`

**Step 3: Switch to worktree**

```bash
cd .worktrees/ui-refactor
```

---

## Task 2: Migrate semantic-chunker to services/rag

**Files:**
- Create: `apps/web/services/rag/semantic-chunker.ts`
- Create: `apps/web/services/rag/utils/cosine-similarity.ts`
- Source: `apps/web/features/ai/rag/semantic-chunker.ts`
- Source: `apps/web/features/ai/rag/utils/cosine-similarity.ts`

**Step 1: Create services/rag/utils directory**

```bash
mkdir -p apps/web/services/rag/utils
```

**Step 2: Copy cosine-similarity.ts**

```bash
cp apps/web/features/ai/rag/utils/cosine-similarity.ts apps/web/services/rag/utils/cosine-similarity.ts
```

**Step 3: Copy semantic-chunker.ts**

```bash
cp apps/web/features/ai/rag/semantic-chunker.ts apps/web/services/rag/semantic-chunker.ts
```

**Step 4: Update imports in semantic-chunker.ts**

Open `apps/web/services/rag/semantic-chunker.ts` and update:

```typescript
// Change from:
import { cosineSimilarity } from "./utils/cosine-similarity";

// To:
import { cosineSimilarity } from "./utils";
```

**Step 5: Update services/rag/index.ts to export new functions**

Add to `apps/web/services/rag/index.ts`:

```typescript
export {
  semanticChunk,
  semanticChunkConversation,
  type SemanticChunk,
  type SemanticChunkOptions,
} from "./semantic-chunker";

export {
  cosineSimilarity,
} from "./utils/cosine-similarity";
```

**Step 6: Run typecheck**

```bash
pnpm --filter @nexusnote/web typecheck
```

Expected: No errors (or fix import paths)

**Step 7: Commit**

```bash
git add apps/web/services/
git commit -m "feat(services): add semantic-chunker to services/rag

- Migrate semantic-chunker from features/ai/rag
- Add cosine-similarity utility
- Export from services/rag index"
```

---

## Task 3: Delete duplicates from features/ai/

**Files:**
- Delete: `apps/web/features/ai/rag/` (entire directory)
- Delete: `apps/web/features/ai/provider.ts`

**Step 1: Delete features/ai/rag directory**

```bash
rm -rf apps/web/features/ai/rag
```

**Step 2: Delete features/ai/provider.ts**

```bash
rm apps/web/features/ai/provider.ts
```

**Step 3: Verify files deleted**

```bash
ls apps/web/features/ai/
```

Expected: No `rag/` directory, no `provider.ts` file

**Step 4: Run typecheck**

```bash
pnpm --filter @nexusnote/web typecheck
```

Expected: Errors (imports will be fixed in later tasks)

**Step 5: Commit**

```bash
git add apps/web/features/
git commit -m "refactor: remove duplicate rag and provider from features/ai

- Delete features/ai/rag/ (replaced by services/rag)
- Delete features/ai/provider.ts (replaced by infrastructure/ai/provider)"
```

---

## Task 4: Rename features/ to ui/

**Step 1: Rename directory**

```bash
git mv apps/web/features apps/web/ui
```

**Step 2: Update tsconfig.json paths**

Edit `apps/web/tsconfig.json`, change:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"],
      "@/features/*": ["./features/*"],  // DELETE THIS LINE
      "@/ui/*": ["./ui/*"]                // ADD THIS LINE
    }
  }
}
```

**Step 3: Update all import paths**

Find and replace in all files:

```bash
# Find all files with @/features imports
grep -r "@/features/" apps/web/ --include="*.ts" --include="*.tsx" -l
```

For each file, replace:
- `@/features/` → `@/ui/`

**Step 4: Run typecheck**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 5: Commit**

```bash
git add apps/web/
git commit -m "refactor: rename features/ to ui/

- Rename features directory to ui
- Update tsconfig paths
- Update all import paths from @/features/* to @/ui/*"
```

---

## Task 5: Update API route imports

**Files:**
- Modify: `apps/web/app/api/chat/route.ts`

**Step 1: Check current imports**

```bash
grep "import.*@/features" apps/web/app/api/chat/route.ts
```

**Step 2: Update imports in chat/route.ts**

Replace any `@/features/` imports with appropriate new imports:

```typescript
// If using RAG:
- import { hybridSearch } from "@/features/ai/rag"
+ import { hybridSearch } from "@/services/rag"

// If using AI tools:
- import { xxx } from "@/features/ai/tools"
+ import { xxx } from "@/ui/ai/tools"
```

**Step 3: Run typecheck**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 4: Commit**

```bash
git add apps/web/app/api/chat/route.ts
git commit -m "fix: update chat route imports after refactor"
```

---

## Task 6: Final verification

**Step 1: Run full typecheck**

```bash
pnpm typecheck
```

**Step 2: Verify directory structure**

```bash
ls -la apps/web/ui/
ls -la apps/web/services/
ls -la apps/web/infrastructure/
```

Expected: All three directories exist, no `features/` directory

**Step 3: Check for any remaining features imports**

```bash
grep -r "@/features" apps/web/ --include="*.ts" --include="*.tsx"
```

Expected: No results

**Step 4: Final commit if needed**

```bash
git add .
git commit -m "refactor: complete features to UI migration

- Rename features/ to ui/
- Remove duplicate code
- Migrate semantic-chunker to services/rag/
- Update all import paths
- All typechecks passing"
```

---

## Task 7: Merge to main and cleanup

**Step 1: Switch to main**

```bash
git checkout main
```

**Step 2: Merge refactor branch**

```bash
git merge refactor/features-to-ui --no-ff
```

**Step 3: Resolve conflicts if any**

Review conflicts and ensure correct version is used

**Step 4: Push to remote**

```bash
git push origin main
```

**Step 5: Cleanup worktree**

```bash
git worktree remove .worktrees/ui-refactor
git branch -d refactor/features-to-ui
```

---

## Post-Implementation

**Verification:**
- [ ] All imports work correctly
- [ ] Typecheck passes
- [ ] App runs without errors
- [ ] No `features/` directory remains
- [ ] semantic-chunker available in services/rag

# AGENTS.md

Guide for AI coding agents working on the NexusNote codebase.

## Project Overview

NexusNote is an AI-native knowledge management system built as a Turborepo monorepo with Tiptap v3 editor, Yjs collaboration, Vercel AI SDK 6.x, and FSRS-5 spaced repetition.

## Build / Lint / Test Commands

```bash
pnpm dev                  # Start all services
pnpm build                # Production build
pnpm lint                 # Run Biome linter
pnpm lint:fix             # Auto-fix lint issues
pnpm format               # Format code with Biome
pnpm typecheck            # Type check all packages
pnpm db:push              # Push schema changes to database
pnpm db:studio            # Open Drizzle Studio GUI
pnpm db:generate          # Generate migration files
docker compose up -d      # Start local database services
```

### Running Single Tests

```bash
pnpm --filter @nexusnote/db test                    # Tests for a package
pnpm --filter @nexusnote/db test -- path/to/test.ts # Single test file
```

## Project Structure

```
nexusnote/
├── apps/
│   ├── web/                    # Next.js 16 app (app/, features/, lib/)
│   └── collab/                 # Collaboration WebSocket server
├── packages/
│   ├── db/                     # Drizzle ORM schema & migrations
│   ├── config/                 # Zod-validated environment config
│   ├── types/                  # Shared TypeScript types
│   ├── ui/                     # Shared UI components (Radix)
│   └── ai-core/                # AI infrastructure
└── turbo.json
```

## Code Style Guidelines

### Formatting (Biome)

- 2 spaces, 100 char line width, double quotes, always semicolons, no trailing commas

### Imports (auto-organized by Biome)

```typescript
// 1. External packages
import { type NextRequest, NextResponse } from "next/server";
// 2. Workspace packages (@nexusnote/*)
import { db, users } from "@nexusnote/db";
import { env } from "@nexusnote/config";
// 3. Local imports (@/ alias)
import { getAgent } from "@/features/ai/agents";
// 4. Type-only imports
import type { User } from "@nexusnote/db";
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Editor.tsx`, `ToolbarButton` |
| Hooks | camelCase + `use` | `useEditorStore.ts` |
| API Routes | lowercase | `route.ts` |
| DB tables | camelCase plural | `users`, `documentChunks` |
| Types | PascalCase | `User`, `NewUser` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_MAX_STEPS` |

### React Components

```tsx
"use client";

interface EditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
}

export function Editor({ content = "", placeholder = "Type / for commands...", onChange }: EditorProps) {
  const [showSlash, setShowSlash] = useState(false);
  if (!editor) return null;
  return <div className="...">{/* JSX */}</div>;
}

export default Editor;
```

### Error Handling

```typescript
// Use custom APIError class in API routes
class APIError extends Error {
  constructor(message: string, public statusCode: number, public code: string) {
    super(message);
    this.name = "APIError";
  }
}

// Use descriptive log prefixes
console.error("[Usage] Failed to track:", error);
```

### Database (Drizzle ORM)

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### AI Agents

```typescript
import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";

function createAgent(id: string, model, instructions: string, tools: ToolSet) {
  return new ToolLoopAgent({ id, model, instructions, tools, stopWhen: stepCountIs(20) });
}
```

### Environment Config

```typescript
import { env } from "@nexusnote/config";
const dbUrl = env.DATABASE_URL;
const model = env.AI_MODEL;
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Editor | Tiptap v3 + Yjs |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle |
| AI | Vercel AI SDK 6.x (Gemini 3) |
| Linting | Biome |
| Monorepo | Turborepo + pnpm |

## Pre-commit Checklist

1. `pnpm lint` passes
2. `pnpm typecheck` passes
3. `pnpm build` succeeds
4. Schema changes include migrations (`pnpm db:generate`)
5. No secrets committed

## Notes

- UI language: Chinese (zh-CN); comments/docs: English
- Use `lang="zh-CN"` in HTML templates

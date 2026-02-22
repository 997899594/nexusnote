# AGENTS.md

Guide for AI coding agents working on the NexusNote codebase.

## Project Overview

NexusNote is an AI-native knowledge management system built as a Turborepo monorepo with Tiptap v3 editor, Yjs collaboration, Vercel AI SDK 6.x, and FSRS-5 spaced repetition.

## Build / Lint / Test Commands

```bash
pnpm dev                  # Start all services
pnpm build                # Production build
pnpm lint                 # Run Biome linter (no ESLint)
pnpm lint:fix             # Auto-fix lint issues
pnpm format               # Format code with Biome
pnpm typecheck            # Type check all packages
pnpm db:push              # Push schema changes to database
pnpm db:studio            # Open Drizzle Studio GUI
pnpm db:generate          # Generate migration files
pnpm db:migrate           # Run migrations
docker compose up -d      # Start local PostgreSQL + Redis services
```

### Running Single Tests

```bash
pnpm --filter @nexusnote/db test                    # Tests for a package
pnpm --filter @nexusnote/db test -- path/to/test.ts # Single test file
```

> **Note:** No test files or test runner config (vitest/jest) exist yet. The `test` scripts are present in `package.json` but `turbo.json` has no `test` task defined. Add both before writing tests.

## Project Structure

```
nexusnote/
├── apps/
│   ├── web/                    # Next.js 16 app — the ACTIVE app (app/, features/, lib/)
│   │   └── party/              # PartyKit collaboration server (y-partykit)
│   └── legacy-web/             # DEPRECATED — do not add features here
├── packages/
│   ├── db/                     # Drizzle ORM schema, migrations, DB client singleton
│   ├── config/                 # Zod-validated environment config (proxy-based, lazy)
│   ├── types/                  # Shared TypeScript types
│   ├── ui/                     # Shared UI components (Radix + CVA + Tailwind)
│   ├── ai-core/                # CircuitBreaker, PromptRegistry, safeGenerateObject
│   └── fsrs/                   # FSRS-5 spaced repetition (pure functions, zero deps)
└── turbo.json
```

## Code Style Guidelines

### Formatting (Biome — sole linter/formatter, no ESLint)

- 2-space indent, 100-char line width, double quotes, always semicolons, no trailing commas
- **Avoid `any` types and non-null assertions (`!`)** — Biome rules are set to `off` for backwards compatibility, but new code should use proper types (`unknown`, optional chaining `?.`, type guards)
- Unused imports/variables emit **warnings**, not errors — fix them anyway

### Imports (auto-organized by Biome `organizeImports`)

```typescript
// 1. External packages
import { type NextRequest, NextResponse } from "next/server";
// 2. Workspace packages (@nexusnote/*)
import { db, users } from "@nexusnote/db";
import { env } from "@nexusnote/config";
// 3. Local imports (@/ alias = apps/web root)
import { getAgent } from "@/features/ai/agents";
// 4. Type-only imports last
import type { User } from "@nexusnote/db";
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Editor.tsx`, `ToolbarButton` |
| Hooks | camelCase + `use` prefix | `useEditorStore.ts` |
| API Routes | lowercase | `route.ts` |
| DB tables | camelCase plural | `users`, `documentChunks` |
| Types | PascalCase | `User`, `NewUser` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_MAX_STEPS` |
| Feature dirs | lowercase | `features/ai`, `features/chat` |

### React Components

```tsx
"use client"; // always first for client components

interface EditorProps {
  content?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
}

export function Editor({ content = "", placeholder = "输入 / 查看命令...", onChange }: EditorProps) {
  const editor = useEditor({ ... });
  if (!editor) return null; // guard before render
  return <div className="...">{/* JSX */}</div>;
}

export default Editor; // both named and default export
```

### Shared UI Components (`packages/ui`)

```tsx
import { cva } from "class-variance-authority";
import { cn } from "@nexusnote/ui/utils"; // twMerge + clsx

const buttonVariants = cva("base-classes", { variants: { variant: {}, size: {} } });

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"; // Radix Slot for polymorphic
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";
```

### Zustand Stores

```typescript
export const useEditorStore = create<EditorState>((set) => ({
  document: null,
  isLoading: false,
  setDocument: (document) => set({ document, isDirty: false }),
  updateContent: (content) => set((state) => ({ ...state, content })),
}));
```

### Error Handling

```typescript
// Custom APIError for API routes
class APIError extends Error {
  constructor(message: string, public statusCode: number, public code: string) {
    super(message);
    this.name = "APIError";
  }
}

function handleError(error: unknown) {
  if (error instanceof APIError) return errorResponse(error.message, error.statusCode, error.code);
  if (error instanceof Error) {
    if (error.name === "ZodError") return errorResponse("请求参数错误", 400, "VALIDATION_ERROR");
    return errorResponse(error.message, 500, "INTERNAL_ERROR");
  }
  return errorResponse("未知错误", 500, "UNKNOWN_ERROR");
}

// Log prefix format: [ModuleName] message
console.error("[Usage] Failed to track:", error);
```

### API Routes

```typescript
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    // ... logic
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[ChatSessions] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
```

### Database (Drizzle ORM)

```typescript
// schema.ts — uuid PKs, timestamp defaults, infer types
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// db client — global singleton to prevent hot-reload leaks
const globalForDb = globalThis as unknown as { db: DrizzleDb };
export const db = globalForDb.db ?? drizzle(pool);
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
```

### AI Agents

```typescript
import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";

const DEFAULT_MAX_STEPS = 20;

function createAgent(id: string, model: LanguageModelV3, instructions: string, tools: ToolSet) {
  return new ToolLoopAgent({ id, model, instructions, tools, stopWhen: stepCountIs(DEFAULT_MAX_STEPS) });
}

export function getAgent(intent: Intent) {
  switch (intent) {
    case "INTERVIEW": return createAgent("interview", ...);
    default:          return createAgent("chat", ...);
  }
}
```

### Environment Config

```typescript
// Always import from @nexusnote/config — never read process.env directly
import { env } from "@nexusnote/config";
const dbUrl = env.DATABASE_URL;
const model = env.AI_MODEL; // e.g. "gemini-3-flash-preview"

// clientEnv for NEXT_PUBLIC_* vars
import { clientEnv } from "@nexusnote/config";
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Editor | Tiptap v3 + Yjs + PartyKit (collab) |
| Database | PostgreSQL 16 + pgvector (halfvec, 4000 dims) |
| ORM | Drizzle |
| Queue | BullMQ + Redis |
| AI | Vercel AI SDK 6.x, 302.ai (OpenAI-compat), Gemini 3 |
| Linting | Biome (no ESLint) |
| Monorepo | Turborepo + pnpm |

## Pre-commit Checklist

1. `pnpm lint` passes
2. `pnpm typecheck` passes
3. `pnpm build` succeeds
4. Schema changes include migrations (`pnpm db:generate`)
5. No secrets committed

## Notes

- UI language: **Chinese (zh-CN)**; code identifiers, comments, docs: English
- Use `lang="zh-CN"` in HTML templates
- Primary AI provider: 302.ai (`AI_302_API_KEY`); fallback keys for DeepSeek/OpenAI/SiliconFlow
- `apps/legacy-web` is deprecated — work only in `apps/web`
- Collaboration: PartyKit server at `apps/web/party/` (replaced legacy `apps/collab`)

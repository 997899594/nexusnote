# Services & Infrastructure Layers Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 arch-redesign 分支的 services/infrastructure 分层架构移植到 main 分支，同时保留 main 中更优的 knowledgeChunks 实现。

**Architecture:**
- `infrastructure/` - 集中管理外部依赖（AI provider, queue）
- `services/` - 业务逻辑层（RAG, 用户画像）
- 保留 `features/` 层作为 UI 相关功能

**Tech Stack:**
- Next.js 15 (App Router)
- Drizzle ORM + PostgreSQL
- AI SDK (Vercel)
- pgvector (向量搜索)

---

## Prerequisites

**Start from:** `main` branch
**Create worktree:** `git worktree add .worktrees/services-impl -b feat/services-infrastructure`

**Reference docs:**
- `docs/plans/2025-02-22-architecture-integration-design.md` - 整体设计
- `/Users/findbiao/projects/nexusnote/.worktrees/arch-redesign/apps/web/services/` - 源代码
- `/Users/findbiao/projects/nexusnote/.worktrees/arch-redesign/apps/web/infrastructure/` - 源代码

---

## Task 1: Create infrastructure/ai/provider

**Files:**
- Create: `apps/web/infrastructure/index.ts`
- Create: `apps/web/infrastructure/ai/provider.ts`
- Create: `apps/web/infrastructure/ai/index.ts`
- Modify: `apps/web/features/ai/provider.ts` (update imports if needed)

**Step 1: Create infrastructure directory structure**

```bash
mkdir -p apps/web/infrastructure/ai
mkdir -p apps/web/infrastructure/queue
```

**Step 2: Create infrastructure/ai/provider.ts**

从 arch-redesign 复制并适配：

```typescript
/**
 * AI Infrastructure - Centralized AI Provider
 *
 * Single source of truth for AI model configuration
 */

import { createOpenAI } from "@ai-sdk/openai";
import type { EmbeddingModelV3, LanguageModelV3 } from "@ai-sdk/provider";
import { extractReasoningMiddleware, wrapLanguageModel } from "ai";

const MODELS = {
  chat: "gemini-3-flash-preview",
  pro: "gemini-3-pro-preview",
  webSearch: "gemini-3-flash-preview-web-search",
  embedding: "Qwen/Qwen3-Embedding-8B",
} as const;

type ModelType = keyof typeof MODELS;

class AIProvider {
  private client: ReturnType<typeof createOpenAI> | null = null;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const apiKey = process.env.AI_302_API_KEY;
    if (!apiKey) {
      console.warn("[Infrastructure] AI_302_API_KEY not set, provider not initialized");
      return;
    }
    this.client = createOpenAI({
      baseURL: "https://api.302.ai/v1",
      apiKey,
    });
    console.log("[Infrastructure] AI Provider initialized: 302.ai");
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  getModel(type: ModelType = "chat"): LanguageModelV3 {
    if (!this.client) {
      throw new Error("AI Provider not initialized. Set AI_302_API_KEY environment variable.");
    }

    const base = this.client.chat(MODELS[type]);
    return wrapLanguageModel({
      model: base,
      middleware: extractReasoningMiddleware({
        tagName: "thinking",
        separator: "\n\n---\n\n",
      }),
    });
  }

  get embeddingModel() {
    if (!this.client) {
      throw new Error("AI Provider not initialized");
    }
    return this.client.embedding(MODELS.embedding);
  }

  get chatModel(): LanguageModelV3 {
    return this.getModel("chat");
  }

  get proModel(): LanguageModelV3 {
    return this.getModel("pro");
  }

  get webSearchModel(): LanguageModelV3 {
    return this.getModel("webSearch");
  }
}

export const aiProvider = new AIProvider();
```

**Step 3: Create infrastructure/ai/index.ts**

```typescript
/**
 * AI Infrastructure exports
 */

export { aiProvider } from "./provider";
```

**Step 4: Create infrastructure/queue/index.ts**

```typescript
/**
 * Queue Infrastructure exports
 */

// TODO: Add queue configuration when needed
export const queueConfig = {
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: parseInt(process.env.REDIS_PORT || "6379", 10),
};
```

**Step 5: Create infrastructure/index.ts**

```typescript
/**
 * Infrastructure Layer
 *
 * Centralized external dependencies and configurations
 * - AI providers (LLM, embedding models)
 * - Background job queues (BullMQ)
 * - Database connections
 *
 * Rules:
 * - No business logic here
 * - No feature-specific code
 * - Services layer depends on this, never the other way around
 */

export * from "./ai";
export * from "./queue";
```

**Step 6: Run typecheck**

```bash
pnpm --filter @nexusnote/web typecheck
```

Expected: No errors (or fix import paths if needed)

**Step 7: Commit**

```bash
git add apps/web/infrastructure/
git commit -m "feat(infrastructure): add AI provider and queue infrastructure

- Centralize AI provider configuration
- Add infrastructure layer with ai and queue modules
- No business logic, only external dependency management"
```

---

## Task 2: Create services/profile

**Files:**
- Create: `apps/web/services/index.ts`
- Create: `apps/web/services/profile/index.ts`
- Create: `apps/web/services/profile/ProfileService.ts`

**Step 1: Create services directory**

```bash
mkdir -p apps/web/services/profile
```

**Step 2: Create services/profile/ProfileService.ts**

```typescript
/**
 * ProfileService - User Learning Profile Management
 *
 * CRUD operations for user learning profiles
 * Profiles accumulate across courses for personalized learning
 */

import { db, userProfiles, eq } from "@nexusnote/db";
import type { UserProfile } from "@nexusnote/db";
import { embedMany } from "ai";
import { aiProvider } from "@/infrastructure/ai/provider";

export interface CreateProfileInput {
  userId: string;
  learningGoals?: { goals: string[]; priority: string[] };
  knowledgeAreas?: { areas: string[]; proficiency: Record<string, string> };
  learningStyle?: { preferredFormat: string; pace: string };
}

export interface UpdateProfileInput {
  learningGoals?: { goals: string[]; priority: string[] };
  knowledgeAreas?: { areas: string[]; proficiency: Record<string, string> };
  learningStyle?: { preferredFormat: string; pace: string };
  assessmentHistory?: { scores: number[]; timestamps: string[]; topics: string[] };
  currentLevel?: "beginner" | "intermediate" | "advanced";
  totalStudyMinutes?: number;
}

/**
 * Get or create user profile
 */
export async function getOrCreate(userId: string): Promise<UserProfile> {
  let profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.userId, userId),
  });

  if (profile) {
    return profile;
  }

  console.log(`[ProfileService] Creating new profile for user: ${userId}`);

  const newProfile = await db
    .insert(userProfiles)
    .values({
      userId,
      learningGoals: { goals: [], priority: [] },
      knowledgeAreas: { areas: [], proficiency: {} },
      learningStyle: { preferredFormat: "mixed", pace: "moderate" },
      assessmentHistory: { scores: [], timestamps: [], topics: [] },
      currentLevel: "beginner",
      totalStudyMinutes: 0,
    })
    .returning();

  return newProfile[0];
}

/**
 * Update user profile
 */
export async function update(userId: string, data: UpdateProfileInput): Promise<UserProfile> {
  console.log(`[ProfileService] Updating profile for user: ${userId}`);

  const updated = await db
    .update(userProfiles)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId))
    .returning();

  if (!updated || updated.length === 0) {
    throw new Error(`Failed to update profile for user: ${userId}`);
  }

  return updated[0];
}

/**
 * Get user profile as text chunk (for RAG context injection)
 */
export async function getProfileChunk(userId: string): Promise<string> {
  const profile = await getOrCreate(userId);

  const goals = profile.learningGoals?.goals?.join(", ") || "";
  const areas = profile.knowledgeAreas?.areas?.join(", ") || "";
  const style = JSON.stringify(profile.learningStyle || {});
  const level = profile.currentLevel || "beginner";
  const studyMinutes = profile.totalStudyMinutes || 0;

  return `User Learning Profile:
- Learning goals: ${goals}
- Knowledge areas: ${areas}
- Learning style: ${style}
- Current level: ${level}
- Total study time: ${studyMinutes} minutes`;
}

/**
 * Generate embedding for user profile
 */
export async function generateProfileEmbedding(userId: string): Promise<number[] | null> {
  if (!aiProvider.isConfigured()) {
    console.warn("[ProfileService] AI Provider not configured, skipping embedding");
    return null;
  }

  const chunk = await getProfileChunk(userId);

  try {
    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel as any,
      values: [chunk],
    });

    return embeddings[0] || null;
  } catch (error) {
    console.error("[ProfileService] Error generating embedding:", error);
    return null;
  }
}

/**
 * Update user profile embedding
 */
export async function updateProfileEmbedding(userId: string): Promise<void> {
  const embedding = await generateProfileEmbedding(userId);

  if (!embedding) {
    console.warn("[ProfileService] Could not generate embedding for user:", userId);
    return;
  }

  await db
    .update(userProfiles)
    .set({
      profileEmbedding: embedding,
      updatedAt: new Date(),
    })
    .where(eq(userProfiles.userId, userId));

  console.log(`[ProfileService] Updated profile embedding for user: ${userId}`);
}

/**
 * Delete user profile (cascades to knowledge_chunks)
 */
export async function deleteProfile(userId: string): Promise<void> {
  await db.delete(userProfiles).where(eq(userProfiles.userId, userId));
  console.log(`[ProfileService] Deleted profile for user: ${userId}`);
}
```

**Step 3: Create services/profile/index.ts**

```typescript
/**
 * Profile Service exports
 */

export {
  getOrCreate,
  update,
  getProfileChunk,
  updateProfileEmbedding,
  deleteProfile,
  type CreateProfileInput,
  type UpdateProfileInput,
} from "./ProfileService";
```

**Step 4: Create services/index.ts**

```typescript
/**
 * Services Layer
 *
 * Business logic layer, independent of features or UI
 * Integrates with infrastructure layer
 * Provides services to API routes and features
 */

export * as profileService from "./profile";
```

**Step 5: Run typecheck**

```bash
pnpm --filter @nexusnote/web typecheck
```

Expected: Error about `userProfiles` not existing in schema (will fix in Task 3)

**Step 6: Commit**

```bash
git add apps/web/services/
git commit -m "feat(services): add profile service for user learning profiles

- Add ProfileService with CRUD operations
- Support profile embedding for personalized RAG
- Get or create pattern for profiles"
```

---

## Task 3: Add userProfiles to database schema

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0009_add_user_profiles.sql`

**Step 1: Add userProfiles table to schema**

在 `packages/db/src/schema.ts` 中，`users` 表定义之后添加：

```typescript
// User Learning Profiles - Cross-course personal learning data
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }).notNull().unique(),

    // Learning goals and style
    learningGoals: jsonb("learning_goals"),
    knowledgeAreas: jsonb("knowledge_areas"),
    learningStyle: jsonb("learning_style"),

    // Learning history and assessments
    assessmentHistory: jsonb("assessment_history"),

    // Current level
    currentLevel: text("current_level"),
    totalStudyMinutes: integer("total_study_minutes").default(0),

    // Profile embedding (for personalized RAG)
    profileEmbedding: halfvec("profile_embedding"),

    // Metadata
    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    userIdUnique: index("user_profiles_user_id_idx").on(table.userId),
  }),
);
```

**Step 2: Add userProfiles to type exports**

在 `packages/db/src/schema.ts` 的 type exports 部分添加：

```typescript
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
```

**Step 3: Add userProfiles to relations**

在 `usersRelations` 中添加：

```typescript
export const usersRelations = relations(users, ({ many }) => ({
  // ... existing ...
  userProfiles: many(userProfiles),
}));
```

**Step 4: Generate migration**

```bash
pnpm --filter @nexusnote/db db:generate
```

**Step 5: Add HNSW index to migration**

编辑生成的 `packages/db/drizzle/0009_*.sql`，在末尾添加：

```sql
-- Add HNSW index for profile embeddings
CREATE INDEX IF NOT EXISTS "user_profiles_embedding_hnsw_idx" ON "user_profiles" USING hnsw ("profile_embedding" halfvec_cosine_ops);
```

**Step 6: Run migration**

```bash
pnpm --filter @nexusnote/db db:migrate
```

**Step 7: Run typecheck**

```bash
pnpm --filter @nexusnote/web typecheck
```

Expected: No errors

**Step 8: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add userProfiles table with profileEmbedding

- Add user learning profile table
- Support cross-course learning data accumulation
- Add HNSW index for profile vector search
- Add relations and type exports"
```

---

## Task 4: Update courseProfiles schema

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/0010_update_course_profiles.sql`

**Step 1: Add new fields to courseProfiles**

在 `packages/db/src/schema.ts` 的 `courseProfiles` 表中，添加新字段（保留旧字段以兼容）：

```typescript
export const courseProfiles = pgTable(
  "course_profiles",
  {
    // ... existing fields ...
    interviewProfile: jsonb("interview_profile"),
    interviewMessages: jsonb("interview_messages"),

    // NEW: Course lifecycle status (replaces interviewStatus)
    status: text("status").default("idle"),

    // NEW: Current step tracking
    currentStep: jsonb("current_step"),

    // DEPRECATED: Keep for compatibility
    interviewStatus: text("interview_status").default("interviewing"),

    // ... rest of existing fields ...
  },
  // ... existing indexes ...
);
```

**Step 2: Generate and run migration**

```bash
pnpm --filter @nexusnote/db db:generate
pnpm --filter @nexusnote/db db:migrate
```

**Step 3: Commit**

```bash
git add packages/db/
git commit -m "feat(db): add status and currentStep to courseProfiles

- Add status field for course lifecycle management
- Add currentStep for progress tracking
- Keep interviewStatus for backward compatibility"
```

---

## Task 5: Create services/rag (adapt from features/ai/rag)

**Files:**
- Create: `apps/web/services/rag/index.ts`
- Create: `apps/web/services/rag/chunker.ts`
- Create: `apps/web/services/rag/hybrid-search.ts`
- Create: `apps/web/services/rag/query-rewriter.ts`

**Step 1: Create services/rag directory**

```bash
mkdir -p apps/web/services/rag
```

**Step 2: Create services/rag/chunker.ts**

从 `apps/web/features/ai/rag/chunker.ts` 适配，主要改动：
- 使用 `services/` 层的导入
- 保持与 `knowledgeChunks` 的兼容

```typescript
/**
 * Document Chunker - Document chunking and indexing
 *
 * Chunks content and generates vector embeddings for RAG
 */

import { db, documents, knowledgeChunks, eq, sql } from "@nexusnote/db";
import { embedMany } from "ai";
import { aiProvider } from "@/infrastructure/ai/provider";

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
}

export interface IndexOptions extends ChunkOptions {
  userId?: string;
  metadata?: Record<string, unknown>;
}

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 50;

/**
 * Split text into chunks with overlap
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_OVERLAP,
): string[] {
  if (!text || text.length <= chunkSize) {
    return text ? [text] : [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start = end - overlap;
  }

  return chunks;
}

/**
 * Index document into knowledge_chunks
 */
export async function indexDocument(
  documentId: string,
  plainText: string,
  options: IndexOptions = {},
): Promise<{ success: boolean; chunksCount: number }> {
  const { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP, userId, metadata } = options;

  console.log(`[Chunker] Indexing document: ${documentId}, text length: ${plainText.length}`);

  try {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Clear old chunks for this document
    await db.delete(knowledgeChunks).where(
      eq(knowledgeChunks.sourceId, documentId)
    );
    console.log(`[Chunker] Cleared old chunks for: ${documentId}`);

    // Split into chunks
    const chunks = chunkText(plainText, chunkSize, overlap);
    console.log(`[Chunker] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return { success: true, chunksCount: 0 };
    }

    // Generate embeddings
    if (!aiProvider.isConfigured()) {
      throw new Error("[Chunker] Embedding model not configured");
    }

    const { embeddings } = await embedMany({
      model: aiProvider.embeddingModel as any,
      values: chunks,
    });

    console.log(`[Chunker] Generated ${embeddings.length} embeddings`);

    // Insert into database
    const newChunks = chunks.map((content, index) => ({
      sourceType: "document" as const,
      sourceId: documentId,
      content,
      embedding: embeddings[index],
      chunkIndex: index,
      userId: userId || null,
      metadata: metadata || null,
    }));

    const batchSize = 50;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize);
      await db.insert(knowledgeChunks).values(batch);
    }

    console.log(`[Chunker] ✅ Indexed ${chunks.length} chunks for: ${documentId}`);
    return {
      success: true,
      chunksCount: chunks.length,
    };
  } catch (error) {
    console.error(`[Chunker] ❌ Error indexing document:`, error);
    throw error;
  }
}

/**
 * Reindex all documents
 */
export async function reindexAllDocuments(): Promise<{ success: boolean; processed: number }> {
  const allDocs = await db.query.documents.findMany();

  let processed = 0;
  for (const doc of allDocs) {
    if (!doc.plainText) continue;

    try {
      await indexDocument(doc.id, doc.plainText, { userId: doc.workspaceId });
      processed++;
    } catch (error) {
      console.error(`[Chunker] Failed to reindex document ${doc.id}:`, error);
    }
  }

  console.log(`[Chunker] Reindexed ${processed}/${allDocs.length} documents`);
  return { success: true, processed };
}

export type ChunkOptions = ChunkOptions;
```

**Step 3: Create services/rag/hybrid-search.ts**

从 `apps/web/features/ai/rag/hybrid-search.ts` 适配：

```typescript
/**
 * Hybrid Search - Vector + Keyword + RRF fusion
 */

import { db, sql, knowledgeChunks } from "@nexusnote/db";
import { embedMany } from "ai";
import { aiProvider } from "@/infrastructure/ai/provider";

export interface HybridSearchResult {
  id: string;
  sourceId: string;
  sourceType: string;
  content: string;
  score: number;
  searchSource: "vector" | "keyword" | "both";
}

// ... rest of implementation (adapted from features/ai/rag/hybrid-search.ts)
```

**Step 4: Create services/rag/index.ts**

```typescript
/**
 * RAG Service exports
 */

export {
  chunkText,
  indexDocument,
  reindexAllDocuments,
  type ChunkOptions,
} from "./chunker";

export {
  hybridSearch,
  type HybridSearchResult,
} from "./hybrid-search";

export {
  rewriteQuery,
} from "./query-rewriter";
```

**Step 5: Update services/index.ts**

```typescript
export * as profileService from "./profile";
export * as ragService from "./rag";
```

**Step 6: Run typecheck and fix imports**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 7: Commit**

```bash
git add apps/web/services/
git commit -m "feat(services): add RAG service layer

- Adapt RAG functionality from features/ai/rag
- Use knowledgeChunks table
- Integrate with infrastructure/ai/provider"
```

---

## Task 6: Update tsconfig paths

**Files:**
- Modify: `apps/web/tsconfig.json`

**Step 1: Add @/services and @/infrastructure paths**

在 `tsconfig.json` 的 `paths` 中添加：

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@/services/*": ["./services/*"],
      "@/infrastructure/*": ["./infrastructure/*"]
    }
  }
}
```

**Step 2: Run typecheck**

```bash
pnpm --filter @nexusnote/web typecheck
```

**Step 3: Commit**

```bash
git add apps/web/tsconfig.json
git commit -m "config: add services and infrastructure path aliases"
```

---

## Task 7: Verification & Testing

**Step 1: Run all typechecks**

```bash
pnpm typecheck
```

**Step 2: Run database migrations**

```bash
pnpm --filter @nexusnote/db db:migrate
```

**Step 3: Manual verification**

1. Check infrastructure/ai/provider exports work
2. Check services/profile getOrCreate creates profiles
3. Check services/rag chunker works with knowledgeChunks

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete services/infrastructure layers integration

- infrastructure/ai/provider: centralized AI configuration
- services/profile: user learning profile management
- services/rag: adapted from features/ai/rag
- userProfiles table with profileEmbedding
- courseProfiles status and currentStep fields
- Updated tsconfig paths"
```

---

## Post-Implementation

**Cleanup:**
- Remove arch-redesign worktree: `git worktree remove .worktrees/arch-redesign`
- Remove refactor-v2 worktree: `git worktree remove .worktrees/refactor-v2`

**Next steps:**
- Update API routes to use services layer
- Add profile embedding generation on course completion
- Add tests for services layer

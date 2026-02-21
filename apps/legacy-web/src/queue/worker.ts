/**
 * BullMQ Worker - RAG Document Indexing
 *
 * 后台任务 worker，处理文档 RAG 索引
 * - 接收 Hocuspocus 触发的索引任务
 * - 分块文档内容
 * - 生成向量嵌入
 * - 存储到 documentChunks 表
 *
 * 启动方式:
 * npm run queue:worker
 */

import { env } from "@nexusnote/config";
import { courseProfiles, db, documentChunks, documents, eq, extractedNotes, sql, topics } from "@nexusnote/db";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import type { CourseGenerationJobData, CourseGenerationProgress } from "@/lib/queue/course-generation";
import type { CourseGenerationContext } from "@/features/learning/agents/course-generation/agent";
import { isEmbeddingConfigured, registry } from "@/features/shared/ai/registry";
import { generateEmbeddings } from "./utils/embeddings";

// Redis 连接
const redis = new IORedis(env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

/**
 * 文本分块函数
 * 将长文本分成指定大小的块
 */
function chunkText(
  text: string,
  chunkSize: number = env.RAG_CHUNK_SIZE || 500,
  overlap: number = env.RAG_CHUNK_OVERLAP || 50,
): string[] {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    // 获取当前块
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end).trim();

    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    // 移动到下一个块，保留重叠部分
    start = end - overlap;

    // 防止无限循环
    if (start >= text.length) {
      break;
    }
  }

  return chunks;
}

/**
 * 处理 RAG 索引任务
 */
async function processRAGIndexJob(job: { data: { documentId: string; plainText: string } }) {
  const { documentId, plainText } = job.data;

  console.log(`[RAG Worker] Processing document: ${documentId}`);
  console.log(`[RAG Worker] Text length: ${plainText.length}`);

  try {
    // 1. 验证文档存在
    const document = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // 2. 清理旧的 chunks（可选：先删除该文档的所有旧 chunks）
    await db.delete(documentChunks).where(eq(documentChunks.documentId, documentId));

    console.log(`[RAG Worker] Cleared old chunks for: ${documentId}`);

    // 3. 分块文本
    const chunks = chunkText(plainText);
    console.log(`[RAG Worker] Created ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.log(`[RAG Worker] No chunks to index for: ${documentId}`);
      return { success: true, chunksCount: 0 };
    }

    // 4. 为每个 chunk 生成嵌入
    // 使用 AI SDK v6 的 embedMany（推荐方案）
    // 优势：
    // - 单次 API 调用处理所有文本（不是逐个）
    // - 内置并行处理（maxParallelCalls: 5）
    // - Langfuse 自动追踪
    // - 官方推荐的标准方式

    if (!isEmbeddingConfigured()) {
      throw new Error("[RAG Worker] Embedding model not configured");
    }

    const embeddings = await generateEmbeddings(chunks, registry.embeddingModel!);

    console.log(
      `[RAG Worker] Generated ${embeddings.length} embeddings (using AI SDK v6 embedMany)`,
    );

    // 5. 批量插入到数据库
    // embeddings 来自 AI SDK v6 embedMany，格式为 number[][]
    const newChunks = chunks.map((content, index) => ({
      documentId,
      content,
      embedding: embeddings[index], // AI SDK embedMany 保证每个都有值，无需 || null
      chunkIndex: index,
    }));

    // 分批插入（避免一次性插入过多）
    const batchSize = 50;
    for (let i = 0; i < newChunks.length; i += batchSize) {
      const batch = newChunks.slice(i, i + batchSize);
      await db.insert(documentChunks).values(batch).onConflictDoNothing();
    }

    console.log(`[RAG Worker] ✅ Indexed ${chunks.length} chunks for: ${documentId}`);

    return {
      success: true,
      chunksCount: chunks.length,
      embeddingsGenerated: embeddings.length,
    };
  } catch (err) {
    console.error(`[RAG Worker] ❌ Error processing document:`, err);
    throw err;
  }
}

/**
 * 启动 RAG Worker
 */
async function startWorker() {
  console.log("[RAG Worker] Starting BullMQ worker...");

  const worker = new Worker("rag-index", processRAGIndexJob, {
    connection: redis,
    concurrency: env.QUEUE_RAG_CONCURRENCY || 3,
    stalledInterval: 5000,
    maxStalledCount: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[RAG Worker] ✅ Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[RAG Worker] ❌ Job ${job?.id} failed:`,
      err instanceof Error ? err.message : err,
    );
  });

  worker.on("error", (err) => {
    console.error("[RAG Worker] Worker error:", err);
  });

  worker.on("stalled", (job) => {
    console.warn(`[RAG Worker] ⚠️  Job ${job} stalled`);
  });

  console.log("[RAG Worker] ✅ Worker ready");

  return worker;
}

/**
 * 处理笔记分类任务
 * 1. 生成嵌入向量
 * 2. 找到最相近的主题（或创建新主题）
 * 3. 更新笔记状态
 */
async function processNoteClassifyJob(job: {
  data: { noteId: string; userId: string; content: string };
}) {
  const { noteId, userId, content } = job.data;

  console.log(`[Note Classify] Processing note: ${noteId}`);

  try {
    if (!isEmbeddingConfigured()) {
      throw new Error("[Note Classify] Embedding model not configured");
    }

    // 1. 生成嵌入
    const [embedding] = await generateEmbeddings([content], registry.embeddingModel!);

    // 2. 查找最相近的主题（余弦相似度）
    const threshold = env.NOTES_TOPIC_THRESHOLD || 0.25;
    const similarTopics = await db.execute<{
      id: string;
      name: string;
      similarity: number;
    }>(sql`
      SELECT id, name, 1 - (embedding <=> ${JSON.stringify(embedding)}::halfvec) as similarity
      FROM topics
      WHERE user_id = ${userId}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(embedding)}::halfvec
      LIMIT 1
    `);

    let topicId: string | null = null;

    if (similarTopics.length > 0) {
      const bestMatch = similarTopics[0];
      if (bestMatch.similarity >= threshold) {
        topicId = bestMatch.id;
        console.log(
          `[Note Classify] Matched topic: ${bestMatch.name} (similarity: ${bestMatch.similarity.toFixed(3)})`,
        );

        // 更新主题的笔记数量
        await db
          .update(topics)
          .set({
            noteCount: sql`${topics.noteCount} + 1`,
            lastActiveAt: new Date(),
          })
          .where(eq(topics.id, topicId));
      }
    }

    // 3. 如果没有匹配的主题，暂时不创建新主题（等积累足够笔记后批量聚类）
    // TODO: 可以添加定时任务进行聚类

    // 4. 更新笔记
    await db
      .update(extractedNotes)
      .set({
        embedding,
        topicId,
        status: "classified",
      })
      .where(eq(extractedNotes.id, noteId));

    console.log(`[Note Classify] ✅ Classified note: ${noteId}, topic: ${topicId || "none"}`);

    return { success: true, noteId, topicId };
  } catch (err) {
    console.error(`[Note Classify] ❌ Error:`, err);
    throw err;
  }
}

/**
 * 启动笔记分类 Worker
 */
async function startNoteClassifyWorker() {
  console.log("[Note Classify] Starting worker...");

  const worker = new Worker("note-classify", processNoteClassifyJob, {
    connection: redis,
    concurrency: 2,
  });

  worker.on("completed", (job) => {
    console.log(`[Note Classify] ✅ Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[Note Classify] ❌ Job ${job?.id} failed:`,
      err instanceof Error ? err.message : err,
    );
  });

  console.log("[Note Classify] ✅ Worker ready");

  return worker;
}

/**
 * 处理课程生成任务
 * 1. 从 DB 加载 courseProfile（包含 interviewProfile + outlineData）
 * 2. 逐章调用 courseGenerationAgent.generate()
 * 3. 通过 job.updateProgress 报告进度
 */
async function processCourseGenerationJob(job: { data: CourseGenerationJobData; updateProgress: (p: CourseGenerationProgress) => Promise<void> }) {
  const { courseId, userId } = job.data;

  console.log(`[Course Worker] Starting generation for course: ${courseId}`);

  const profile = await db.query.courseProfiles.findFirst({
    where: eq(courseProfiles.id, courseId),
  });

  if (!profile) throw new Error(`Course profile ${courseId} not found`);

  const outline = profile.outlineData as Record<string, unknown> | null;
  if (!outline) throw new Error(`Course ${courseId} has no outline data`);

  const interviewProfile = profile.interviewProfile as Record<string, unknown> | undefined;
  const modules = (outline.modules as Array<{ title: string; chapters: Array<{ title: string }> }>) || [];
  const chapters = outline.chapters
    ? (outline.chapters as Array<{ title: string }>)
    : modules.flatMap((m) => m.chapters ?? []);

  if (chapters.length === 0) throw new Error(`Course ${courseId} has no chapters in outline`);

  // 动态导入避免顶层副作用（模型初始化）
  const { courseGenerationAgent } = await import(
    "@/features/learning/agents/course-generation/agent"
  );

  // 更新状态为 generating
  await db
    .update(courseProfiles)
    .set({ interviewStatus: "generating", updatedAt: new Date() })
    .where(eq(courseProfiles.id, courseId));

  for (let i = 0; i < chapters.length; i++) {
    await job.updateProgress({
      current: i,
      total: chapters.length,
      status: "generating",
      chapterTitle: chapters[i].title,
    });

    console.log(`[Course Worker] Generating chapter ${i + 1}/${chapters.length}: ${chapters[i].title}`);

    await courseGenerationAgent.generate({
      prompt: `请生成第 ${i + 1} 章的内容: ${chapters[i].title}`,
      options: {
        id: courseId,
        userId,
        interviewProfile,
        outlineTitle: profile.title || "",
        outlineData: outline as CourseGenerationContext["outlineData"],
        moduleCount: modules.length,
        totalChapters: chapters.length,
        currentModuleIndex: 0,
        currentChapterIndex: i,
        chaptersGenerated: i,
      },
    });

    console.log(`[Course Worker] Chapter ${i + 1} generated`);
  }

  await job.updateProgress({
    current: chapters.length,
    total: chapters.length,
    status: "completed",
  });

  // 更新状态为 completed
  await db
    .update(courseProfiles)
    .set({ interviewStatus: "completed", updatedAt: new Date() })
    .where(eq(courseProfiles.id, courseId));

  console.log(`[Course Worker] Course ${courseId} generation complete`);
  return { completed: true, chapters: chapters.length };
}

/**
 * 启动 Course Generation Worker
 */
async function startCourseGenerationWorker() {
  console.log("[Course Worker] Starting worker...");

  const worker = new Worker<CourseGenerationJobData>("course-generation", processCourseGenerationJob, {
    connection: redis,
    concurrency: 1,
    limiter: { max: 2, duration: 60_000 },
  });

  worker.on("completed", (job) => {
    console.log(`[Course Worker] Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(
      `[Course Worker] Job ${job?.id} failed:`,
      err instanceof Error ? err.message : err,
    );
  });

  console.log("[Course Worker] Worker ready");
  return worker;
}

// 启动所有 Workers
async function startAllWorkers() {
  const ragWorker = await startWorker();
  const noteClassifyWorker = await startNoteClassifyWorker();
  const courseWorker = await startCourseGenerationWorker();

  // 优雅关闭
  const shutdown = async () => {
    console.log("[Workers] Shutting down...");
    await Promise.all([ragWorker?.close(), noteClassifyWorker?.close(), courseWorker?.close()]);
    await redis.quit();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

startAllWorkers().catch((err) => {
  console.error("[Workers] Failed to start:", err);
  process.exit(1);
});

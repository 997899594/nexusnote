/**
 * Skill Discovery Engine - 技能发现引擎
 *
 * 从用户的活动数据中自动发现和提取技能：
 * - Conversations (对话)
 * - Knowledge Chunks (知识块)
 * - Course Profiles (课程)
 * - Flashcards (闪卡)
 */

import { generateObject } from "ai";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  conversations,
  courseProfiles,
  flashcards,
  knowledgeChunks,
  skills,
  userSkillMastery,
} from "@/db/schema";
import { aiProvider, safeGenerateObject } from "@/lib/ai/core";

// ============================================
// Zod Schemas for Structured Output
// ============================================

/**
 * DiscoveredSkill - 单个技能定义
 */
export const DiscoveredSkillSchema = z.object({
  name: z.string().describe("技能名称，简洁准确"),
  slug: z.string().describe("技能标识符，使用 kebab-case，英文"),
  category: z.string().describe("技能分类: frontend | backend | ml | design | softskill | other"),
  domain: z.string().describe("领域: web | mobile | data | devops | general"),
  description: z.string().describe("技能描述，一句话说明"),
  icon: z.string().describe("技能图标名称 (lucide-react), 如: Code, Database, Brain 等"),
  confidence: z.number().min(0).max(100).describe("置信度 0-100"),
});

export type DiscoveredSkill = z.infer<typeof DiscoveredSkillSchema>;

/**
 * SkillExtractionResult - 技能提取结果
 */
const SkillExtractionResultSchema = z.object({
  skills: z.array(DiscoveredSkillSchema).describe("提取的技能列表"),
  summary: z.string().describe("技能提取总结"),
});

// ============================================
// Data Source Interfaces
// ============================================

interface DataSource {
  type: string;
  items: Array<{
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * 从各数据源收集用户活动数据
 */
async function collectUserData(
  userId: string,
  options: {
    limit?: number;
    sources?: Array<"conversations" | "knowledge" | "courses" | "flashcards">;
  } = {},
): Promise<DataSource[]> {
  const { limit = 50, sources = ["conversations", "knowledge", "courses", "flashcards"] } = options;

  const sourcesData: DataSource[] = [];

  // 1. Conversations - 对话内容
  if (sources.includes("conversations")) {
    const userConversations = await db
      .select({
        id: conversations.id,
        messages: conversations.messages,
        title: conversations.title,
      })
      .from(conversations)
      .where(and(eq(conversations.userId, userId), sql`${conversations.messageCount} > 0`))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);

    const conversationContent = userConversations
      .map((c) => {
        const msgs = c.messages as Array<{ role: string; content: string }>;
        return {
          id: c.id,
          content: `[对话: ${c.title}]\n${msgs.map((m) => `${m.role}: ${m.content}`).join("\n")}`,
        };
      })
      .filter((c) => c.content.length > 50);

    if (conversationContent.length > 0) {
      sourcesData.push({ type: "conversations", items: conversationContent });
    }
  }

  // 2. Knowledge Chunks - 知识块
  if (sources.includes("knowledge")) {
    const userChunks = await db
      .select({
        id: knowledgeChunks.id,
        content: knowledgeChunks.content,
        sourceType: knowledgeChunks.sourceType,
      })
      .from(knowledgeChunks)
      .where(eq(knowledgeChunks.userId, userId))
      .orderBy(desc(knowledgeChunks.createdAt))
      .limit(limit);

    const chunksContent = userChunks
      .map((c) => ({
        id: c.id,
        content: `[${c.sourceType}] ${c.content}`,
      }))
      .filter((c) => c.content.length > 20);

    if (chunksContent.length > 0) {
      sourcesData.push({ type: "knowledge", items: chunksContent });
    }
  }

  // 3. Course Profiles - AI 生成的课程
  if (sources.includes("courses")) {
    const userCourses = await db
      .select({
        id: courseProfiles.id,
        title: courseProfiles.title,
        description: courseProfiles.description,
        outlineMarkdown: courseProfiles.outlineMarkdown,
      })
      .from(courseProfiles)
      .where(eq(courseProfiles.userId, userId))
      .orderBy(desc(courseProfiles.updatedAt))
      .limit(Math.floor(limit / 2));

    const coursesContent = userCourses
      .map((c) => ({
        id: c.id,
        content: `[课程: ${c.title || "未命名"}]\n${c.description || ""}\n${c.outlineMarkdown || ""}`,
      }))
      .filter((c) => c.content.length > 50);

    if (coursesContent.length > 0) {
      sourcesData.push({ type: "courses", items: coursesContent });
    }
  }

  // 4. Flashcards - 闪卡
  if (sources.includes("flashcards")) {
    const userFlashcards = await db
      .select({
        id: flashcards.id,
        front: flashcards.front,
        back: flashcards.back,
        context: flashcards.context,
      })
      .from(flashcards)
      .limit(limit);

    // Note: flashcards doesn't have userId in the current schema
    // We'll skip this for now or join with documents

    const flashcardsContent = userFlashcards
      .map((f) => ({
        id: f.id,
        content: `[闪卡]\n问题: ${f.front}\n答案: ${f.back}\n${f.context || ""}`,
      }))
      .filter((c) => c.content.length > 20);

    if (flashcardsContent.length > 0) {
      sourcesData.push({ type: "flashcards", items: flashcardsContent });
    }
  }

  return sourcesData;
}

/**
 * 使用 AI 从用户数据中提取技能
 */
export async function extractSkillsFromData(
  userId: string,
  options: {
    limit?: number;
    sources?: Array<"conversations" | "knowledge" | "courses" | "flashcards">;
  } = {},
): Promise<DiscoveredSkill[]> {
  const dataSources = await collectUserData(userId, options);

  if (dataSources.length === 0) {
    return [];
  }

  // 构建提示词
  const prompt = buildExtractionPrompt(dataSources);

  try {
    const result = await safeGenerateObject({
      schema: SkillExtractionResultSchema,
      model: aiProvider.proModel,
      system: `你是一个专业的技能分析专家。你的任务是从用户的学习和对话数据中提取出他们掌握或正在学习的技能。

分析规则：
1. 技能应该是具体的、可识别的（如 "React", "TypeScript", "数据分析"）
2. 避免过于泛泛的概念（如 "编程", "学习"）
3. 每个技能应该有足够的证据支持
4. 置信度基于数据中出现的频率和深度
5. 使用 lucide-react 的图标名称

技能分类：
- frontend: 前端开发相关 (React, Vue, CSS, TypeScript...)
- backend: 后端开发相关 (Node.js, Python, PostgreSQL...)
- ml: 机器学习/AI相关 (PyTorch, TensorFlow, NLP...)
- design: 设计相关 (UI/UX, Figma, 色彩理论...)
- softskill: 软技能 (沟通, 团队协作, 时间管理...)
- other: 其他领域`,
      prompt,
      temperature: 0.3,
    });

    return result.skills;
  } catch (error) {
    console.error("[SkillDiscovery] 提取技能失败:", error);
    return [];
  }
}

/**
 * 构建技能提取提示词
 */
function buildExtractionPrompt(dataSources: DataSource[]): string {
  const parts = ["请分析以下用户活动数据，提取出用户掌握或正在学习的技能：\n"];

  for (const source of dataSources) {
    parts.push(`## ${source.type} (${source.items.length} 项)\n`);

    // 限制每个来源的内容长度
    const items = source.items.slice(0, 10);
    for (const item of items) {
      const truncatedContent = item.content.slice(0, 500);
      parts.push(`${truncatedContent}${item.content.length > 500 ? "..." : ""}\n`);
    }
    parts.push("\n");
  }

  parts.push(
    "请提取 5-15 个最显著的技能，返回 JSON 格式，包含每个技能的 name, slug, category, domain, description, icon, confidence。",
  );

  return parts.join("");
}

/**
 * 保存发现的技能到数据库
 */
export async function saveDiscoveredSkills(
  userId: string,
  discoveredSkills: DiscoveredSkill[],
): Promise<void> {
  for (const skill of discoveredSkills) {
    // 检查技能是否已存在
    const existing = await db.select().from(skills).where(eq(skills.slug, skill.slug)).limit(1);

    let skillId: string;

    if (existing.length > 0) {
      // 更新现有技能
      skillId = existing[0].id;
      await db
        .update(skills)
        .set({
          description: skill.description,
          icon: skill.icon,
          updatedAt: new Date(),
        })
        .where(eq(skills.id, skillId));
    } else {
      // 创建新技能
      const inserted = await db
        .insert(skills)
        .values({
          name: skill.name,
          slug: skill.slug,
          category: skill.category,
          domain: skill.domain,
          description: skill.description,
          icon: skill.icon,
          isSystem: false,
        })
        .returning();

      skillId = inserted[0].id;
    }

    // 检查用户是否已有此技能掌握记录
    const existingMastery = await db
      .select()
      .from(userSkillMastery)
      .where(and(eq(userSkillMastery.userId, userId), eq(userSkillMastery.skillId, skillId)))
      .limit(1);

    if (existingMastery.length > 0) {
      // 更新掌握度（取最大值）
      const newLevel = Math.max(existingMastery[0].level, Math.ceil(skill.confidence / 20));
      await db
        .update(userSkillMastery)
        .set({
          level: Math.min(newLevel, 5),
          confidence: Math.max(existingMastery[0].confidence, skill.confidence),
          updatedAt: new Date(),
        })
        .where(eq(userSkillMastery.id, existingMastery[0].id));
    } else {
      // 创建新掌握记录
      await db.insert(userSkillMastery).values({
        userId,
        skillId,
        level: Math.ceil(skill.confidence / 20),
        experience: skill.confidence,
        confidence: skill.confidence,
        unlockedAt: new Date(),
      });
    }
  }
}

/**
 * 主函数：发现并保存技能
 */
export async function discoverAndSaveSkills(
  userId: string,
  options: {
    limit?: number;
    sources?: Array<"conversations" | "knowledge" | "courses" | "flashcards">;
  } = {},
): Promise<DiscoveredSkill[]> {
  const discoveredSkills = await extractSkillsFromData(userId, options);
  await saveDiscoveredSkills(userId, discoveredSkills);
  return discoveredSkills;
}

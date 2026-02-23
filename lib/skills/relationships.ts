/**
 * Skill Relationships - 技能关系推理
 *
 * 推理技能之间的关系（前置、相关、包含等）
 */

import { z } from "zod";
import { generateObject } from "ai";
import { db } from "@/db";
import { skills, skillRelationships, userSkillMastery } from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { aiProvider, safeGenerateObject } from "@/lib/ai/core";

// ============================================
// Relationship Types
// ============================================

export const RELATIONSHIP_TYPES = {
  PREREQUISITE: "prerequisite", // 前置技能：需要先掌握
  RELATED: "related", // 相关技能：经常一起使用
  CONTAINS: "contains", // 包含关系：父技能包含子技能
  EXTENDS: "extends", // 扩展关系：基于某技能的延伸
  ALTERNATIVE: "alternative", // 替代关系：可相互替代
} as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[keyof typeof RELATIONSHIP_TYPES];

// ============================================
// Zod Schemas
// ============================================

const SkillRelationshipSchema = z.object({
  sourceSlug: z.string().describe("源技能的 slug"),
  targetSlug: z.string().describe("目标技能的 slug"),
  relationshipType: z.enum(Object.keys(RELATIONSHIP_TYPES) as [RelationshipType, ...RelationshipType[]]).describe("关系类型"),
  strength: z.number().min(0).max(100).describe("关系强度 0-100"),
  reason: z.string().describe("关系理由，简要说明为什么存在这个关系"),
});

const RelationshipInferenceResultSchema = z.object({
  relationships: z.array(SkillRelationshipSchema).describe("推理出的技能关系"),
});

export type SkillRelationship = z.infer<typeof SkillRelationshipSchema>;

// ============================================
// Relationship Inference
// ============================================

/**
 * 使用 AI 推理技能之间的关系
 */
export async function inferSkillRelationships(
  skillSlugs: string[],
): Promise<SkillRelationship[]> {
  if (skillSlugs.length < 2) {
    return [];
  }

  // 获取技能信息
  const skillsList = await db
    .select()
    .from(skills)
    .where(inArray(skills.slug, skillSlugs));

  if (skillsList.length < 2) {
    return [];
  }

  // 构建提示词
  const prompt = buildRelationshipPrompt(skillsList);

  try {
    const result = await safeGenerateObject({
      schema: RelationshipInferenceResultSchema,
      model: aiProvider.proModel,
      system: `你是一个技能图谱分析专家。你的任务是基于技术知识，分析一组技能之间的关系。

关系类型说明：
- prerequisite: 前置技能，学习目标技能前需要先掌握的技能
- related: 相关技能，经常在相同场景下使用或讨论
- contains: 包含关系，一个技能是另一个技能的子集或组成部分
- extends: 扩展关系，基于某技能的进阶或专业化方向
- alternative: 替代关系，可以互相替代实现相似目标的技能

推理规则：
1. 只推理高置信度的关系（strength >= 60）
2. 避免过于泛泛的关系
3. 关系应该有明确的技术或学习路径依据
4. 不要创建循环依赖（如果 A 是 B 的前置，B 不应该是 A 的前置）`,
      prompt,
      temperature: 0.2,
    });

    return result.relationships;
  } catch (error) {
    console.error("[SkillRelationships] 推理关系失败:", error);
    return [];
  }
}

/**
 * 构建关系推理提示词
 */
function buildRelationshipPrompt(skillsList: typeof skills.$inferSelect[]): string {
  const skillsInfo = skillsList
    .map((s) => `- ${s.slug} (${s.name}): ${s.description || s.category || s.domain}`)
    .join("\n");

  return `请分析以下技能之间的关系，识别出最重要的 10-20 个关系。

技能列表：
${skillsInfo}

请返回 JSON 格式，包含 sourceSlug, targetSlug, relationshipType, strength, reason。

注意：
- sourceSlug 是关系源技能的 slug
- targetSlug 是关系目标技能的 slug
- 只返回有意义的关系，不要为每对技能都创建关系
- strength 应该基于关系的确定性和重要性（60-100）`;
}

/**
 * 保存推理出的技能关系到数据库
 */
export async function saveSkillRelationships(
  relationships: SkillRelationship[],
): Promise<void> {
  for (const rel of relationships) {
    // 查找技能 ID
    const [sourceSkill, targetSkill] = await Promise.all([
      db.select().from(skills).where(eq(skills.slug, rel.sourceSlug)).limit(1),
      db.select().from(skills).where(eq(skills.slug, rel.targetSlug)).limit(1),
    ]);

    if (sourceSkill.length === 0 || targetSkill.length === 0) {
      console.warn(`[SkillRelationships] 技能不存在: ${rel.sourceSlug} -> ${rel.targetSlug}`);
      continue;
    }

    // 检查关系是否已存在
    const existing = await db
      .select()
      .from(skillRelationships)
      .where(
        and(
          eq(skillRelationships.sourceSkillId, sourceSkill[0].id),
          eq(skillRelationships.targetSkillId, targetSkill[0].id),
          eq(skillRelationships.relationshipType, rel.relationshipType),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // 更新现有关系的强度
      await db
        .update(skillRelationships)
        .set({
          strength: rel.strength,
          confidence: rel.strength, // 使用 strength 作为 confidence
        })
        .where(eq(skillRelationships.id, existing[0].id));
    } else {
      // 创建新关系
      await db.insert(skillRelationships).values({
        sourceSkillId: sourceSkill[0].id,
        targetSkillId: targetSkill[0].id,
        relationshipType: rel.relationshipType,
        strength: rel.strength,
        confidence: rel.strength,
      });
    }
  }
}

/**
 * 主函数：推理并保存技能关系
 */
export async function discoverAndSaveRelationships(
  skillSlugs?: string[],
  userId?: string,
): Promise<SkillRelationship[]> {
  // 如果没有指定技能，获取技能
  let targetSlugs = skillSlugs;
  if (!targetSlugs) {
    // 如果提供了 userId，只获取该用户的技能
    if (userId) {
      const userSkills = await db
        .select({ slug: skills.slug })
        .from(userSkillMastery)
        .innerJoin(skills, eq(userSkillMastery.skillId, skills.id))
        .where(eq(userSkillMastery.userId, userId));
      targetSlugs = userSkills.map((s) => s.slug);
    } else {
      // 否则获取所有技能
      const allSkills = await db.select({ slug: skills.slug }).from(skills);
      targetSlugs = allSkills.map((s) => s.slug);
    }
  }

  const relationships = await inferSkillRelationships(targetSlugs);
  await saveSkillRelationships(relationships);
  return relationships;
}

/**
 * 获取技能的关系网络
 */
export async function getSkillNetwork(skillSlug: string) {
  const skill = await db.select().from(skills).where(eq(skills.slug, skillSlug)).limit(1);

  if (skill.length === 0) {
    return null;
  }

  const skillId = skill[0].id;

  // 获取所有相关关系
  const [outgoingRelations, incomingRelations] = await Promise.all([
    db
      .select({
        relationshipType: skillRelationships.relationshipType,
        strength: skillRelationships.strength,
        targetSkill: skills,
      })
      .from(skillRelationships)
      .where(eq(skillRelationships.sourceSkillId, skillId))
      .innerJoin(skills, eq(skillRelationships.targetSkillId, skills.id)),
    db
      .select({
        relationshipType: skillRelationships.relationshipType,
        strength: skillRelationships.strength,
        sourceSkill: skills,
      })
      .from(skillRelationships)
      .where(eq(skillRelationships.targetSkillId, skillId))
      .innerJoin(skills, eq(skillRelationships.sourceSkillId, skills.id)),
  ]);

  return {
    skill: skill[0],
    outgoing: outgoingRelations,
    incoming: incomingRelations,
  };
}

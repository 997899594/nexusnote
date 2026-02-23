/**
 * Skill Graph Utilities - 技能图工具
 *
 * 图算法和可视化数据准备
 */

import { db } from "@/db";
import { skills, skillRelationships, userSkillMastery } from "@/db/schema";
import { eq, and, or, inArray, sql } from "drizzle-orm";
import type { Node, Edge } from "@xyflow/react";

// ============================================
// Types
// ============================================

export interface SkillNodeData {
  id: string;
  name: string;
  slug: string;
  category: string;
  domain: string;
  description: string | null;
  icon: string | null;
  isSystem: boolean;
  level: number;
  confidence: number;
  unlockedAt: Date | null;
}

export interface SkillEdgeData {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  strength: number;
  confidence: number;
}

export interface SkillGraphData {
  nodes: Node[];
  edges: Edge[];
}

// ============================================
// Graph Data Generation
// ============================================

export async function getUserSkillGraphData(
  userId: string,
  options: {
    includeUnlocked?: boolean;
    maxDepth?: number;
  } = {},
): Promise<SkillGraphData> {
  const { includeUnlocked = true, maxDepth = 2 } = options;

  const userSkills = await db
    .select({
      skill: skills,
      mastery: userSkillMastery,
    })
    .from(userSkillMastery)
    .innerJoin(skills, eq(userSkillMastery.skillId, skills.id))
    .where(eq(userSkillMastery.userId, userId));

  if (userSkills.length === 0) {
    return { nodes: [], edges: [] };
  }

  const skillIds = userSkills.map((us) => us.skill.id);

  const relationships = await db
    .select()
    .from(skillRelationships)
    .where(
      or(
        inArray(skillRelationships.sourceSkillId, skillIds),
        inArray(skillRelationships.targetSkillId, skillIds),
      ),
    );

  const relatedSkillIds = new Set(skillIds);
  for (const rel of relationships) {
    if (includeUnlocked) {
      relatedSkillIds.add(rel.sourceSkillId);
      relatedSkillIds.add(rel.targetSkillId);
    }
  }

  const allSkills = await db
    .select()
    .from(skills)
    .where(inArray(skills.id, Array.from(relatedSkillIds)));

  const skillMap = new Map(allSkills.map((s) => [s.id, s]));
  const masteryMap = new Map(
    userSkills.map((us) => [us.skill.id, us.mastery]),
  );

  const nodes: Node[] = allSkills.map((skill) => {
    const mastery = masteryMap.get(skill.id);
    const nodeType = mastery ? "masteryNode" : "suggestedNode";

    return {
      id: skill.id,
      type: nodeType,
      position: { x: 0, y: 0 },
      data: {
        id: skill.id,
        name: skill.name,
        slug: skill.slug,
        category: skill.category || "other",
        domain: skill.domain || "general",
        description: skill.description,
        icon: skill.icon,
        isSystem: skill.isSystem,
        level: mastery?.level || 0,
        confidence: mastery?.confidence || 0,
        unlockedAt: mastery?.unlockedAt || null,
      },
    };
  });

  const edges: Edge[] = relationships
    .filter((rel) => {
      return skillMap.has(rel.sourceSkillId) && skillMap.has(rel.targetSkillId);
    })
    .map((rel) => {
      const edgeLabel = getEdgeLabel(rel.relationshipType);
      return {
        id: rel.id,
        source: rel.sourceSkillId,
        target: rel.targetSkillId,
        type: getEdgeType(rel.relationshipType),
        label: edgeLabel,
        animated: rel.strength > 80,
        style: {
          strokeWidth: Math.max(1, rel.strength / 25),
          opacity: rel.strength / 100,
        },
        data: {
          id: rel.id,
          source: rel.sourceSkillId,
          target: rel.targetSkillId,
          type: rel.relationshipType,
          label: edgeLabel,
          strength: rel.strength,
          confidence: rel.confidence,
        },
      };
    });

  const layoutedNodes = calculateSimpleLayout(nodes, edges);

  return {
    nodes: layoutedNodes,
    edges,
  };
}

function calculateSimpleLayout(
  nodes: Node[],
  edges: Edge[],
): Node[] {
  const centerX = 400;
  const centerY = 300;
  const radius = Math.min(nodes.length * 30, 250);

  const layoutedNodes = nodes.map((node, i) => {
    const angle = (i / nodes.length) * 2 * Math.PI;
    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      },
    };
  });

  return layoutedNodes;
}

function getEdgeType(relationshipType: string): string {
  switch (relationshipType) {
    case "prerequisite":
      return "smoothstep";
    case "related":
      return "straight";
    case "contains":
      return "default";
    case "extends":
      return "smoothstep";
    case "alternative":
      return "dashed";
    default:
      return "default";
  }
}

function getEdgeLabel(relationshipType: string): string {
  switch (relationshipType) {
    case "prerequisite":
      return "前置";
    case "related":
      return "相关";
    case "contains":
      return "包含";
    case "extends":
      return "扩展";
    case "alternative":
      return "替代";
    default:
      return "";
  }
}

// ============================================
// Skill Recommendations
// ============================================

export async function getRecommendedSkills(
  userId: string,
  limit = 10,
): Promise<Array<{ skill: typeof skills.$inferSelect; reason: string; strength: number }>> {
  const userSkills = await db
    .select({ skillId: userSkillMastery.skillId })
    .from(userSkillMastery)
    .where(eq(userSkillMastery.userId, userId));

  if (userSkills.length === 0) {
    return [];
  }

  const skillIds = userSkills.map((us) => us.skillId);

  const relationships = await db
    .select({
      targetSkill: skills,
      relationshipType: skillRelationships.relationshipType,
      strength: skillRelationships.strength,
    })
    .from(skillRelationships)
    .innerJoin(skills, eq(skillRelationships.targetSkillId, skills.id))
    .where(inArray(skillRelationships.sourceSkillId, skillIds))
    .orderBy(sql`${skillRelationships.strength} DESC`)
    .limit(limit * 2);

  const recommendations = relationships
    .filter((r) => !skillIds.includes(r.targetSkill.id))
    .slice(0, limit)
    .map((r) => ({
      skill: r.targetSkill,
      reason: getRecommendationReason(r.relationshipType),
      strength: r.strength,
    }));

  return recommendations;
}

function getRecommendationReason(relationshipType: string): string {
  switch (relationshipType) {
    case "prerequisite":
      return "这是您已掌握技能的基础";
    case "related":
      return "与您的技能高度相关";
    case "extends":
      return "是您现有技能的进阶方向";
    case "alternative":
      return "可以扩展您的技术选择";
    default:
      return "推荐学习";
  }
}

import { generateText, Output } from "ai";
import { z } from "zod";
import { buildGenerationSettingsForPolicy } from "@/lib/ai/core/generation-settings";
import { getPlainModelForPolicy } from "@/lib/ai/core/model-policy";
import { createTelemetryContext, getErrorMessage, recordAIUsage } from "@/lib/ai/core/telemetry";
import {
  type ComposeGraph,
  type ComposerVisibleNode,
  collectComposerAnchorRefs,
  normalizeText,
} from "@/lib/growth/compose-shared";
import {
  GROWTH_COMPOSE_METADATA_MODEL_LABEL,
  GROWTH_COMPOSE_METADATA_PROMPT_VERSION,
  GROWTH_DIRECTION_METADATA_AI_TIMEOUT_MS,
} from "@/lib/growth/constants";
import {
  buildGrowthComposeMetadataPrompt,
  GROWTH_COMPOSE_METADATA_SYSTEM_PROMPT,
} from "@/lib/growth/prompts";

const nodeMetadataSchema = z.object({
  anchorRef: z.string().trim().min(1),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
});

const careerSenioritySchema = z.enum(["junior", "standard", "senior", "lead", "principal"]);

const careerRoleIdentitySchema = z.object({
  seniority: careerSenioritySchema,
  roleName: z.string().trim().min(1),
  specialization: z.string().trim().min(1).nullable().default(null),
});

const progressionRoleMetadataSchema = z.object({
  id: z.string().trim().min(1),
  role: careerRoleIdentitySchema,
  summary: z.string().trim().min(1),
  horizon: z.enum(["next", "later"]),
  confidence: z.number().min(0).max(1),
  supportingNodeRefs: z.array(z.string().trim().min(1)).min(1),
});

const currentCareerRoleMetadataSchema = z.object({
  role: careerRoleIdentitySchema,
  summary: z.string().trim().min(1),
  whyThisDirection: z.string().trim().min(1),
});

const directionMetadataOutputSchema = z.object({
  currentCareerRole: currentCareerRoleMetadataSchema,
  progressionRoles: z.array(progressionRoleMetadataSchema).min(1).max(3),
  nodeLabels: z.array(nodeMetadataSchema).min(1),
});

const FORBIDDEN_DIRECTION_TITLE_TERMS = [
  "构建者",
  "成长路径",
  "发展方向",
  "学习路线",
  "主线",
  "能力树",
  "技能树",
] as const;

const FORBIDDEN_NON_ROLE_TITLE_TERMS = [
  "助理",
  "协调员",
  "学习者",
  "入门者",
  "初学者",
  "爱好者",
  "实践者",
  "入门工程师",
] as const;

const FORBIDDEN_ROLE_NAME_SENIORITY_TERMS = [
  "初级",
  "中级",
  "高级",
  "资深",
  "专家",
  "负责人",
] as const;

const RAW_INTERNAL_LABEL_PATTERN = /[A-Za-z][A-Za-z0-9+#./-]*\s*&\s*[A-Za-z]|Engineering/i;
const CHINESE_TEXT_PATTERN = /\p{Script=Han}/u;

const SENIORITY_LABELS: Record<z.infer<typeof careerSenioritySchema>, string | null> = {
  junior: "初级",
  standard: null,
  senior: "高级",
  lead: "负责人",
  principal: "专家",
};

const SENIORITY_RANK: Record<z.infer<typeof careerSenioritySchema>, number> = {
  junior: 1,
  standard: 2,
  senior: 3,
  lead: 4,
  principal: 5,
};

export interface GrowthDirectionMetadata {
  keySeed: string;
  roleIdentityKey: string;
  title: string;
  summary: string;
  whyThisDirection: string;
  progressionRoles: Array<{
    id: string;
    title: string;
    summary: string;
    horizon: "next" | "later";
    confidence: number;
    supportingNodeRefs: string[];
  }>;
  nodeLabels: Array<{
    anchorRef: string;
    title: string;
    summary: string;
  }>;
}

function formatMixedLanguageText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/([\p{Script=Han}])([A-Za-z][A-Za-z0-9+#./-]*)/gu, "$1 $2")
    .replace(/([A-Za-z0-9+#./-]+)([\p{Script=Han}])/gu, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCareerRoleTitle(role: z.infer<typeof careerRoleIdentitySchema>): string {
  const seniorityLabel = SENIORITY_LABELS[role.seniority];
  const roleName = formatMixedLanguageText(role.roleName);
  const specialization = role.specialization ? formatMixedLanguageText(role.specialization) : null;
  const roleBase = [specialization, roleName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ");

  if (!seniorityLabel) {
    return formatMixedLanguageText(roleBase);
  }

  return CHINESE_TEXT_PATTERN.test(roleBase[0] ?? "")
    ? formatMixedLanguageText(`${seniorityLabel}${roleBase}`)
    : formatMixedLanguageText(`${seniorityLabel} ${roleBase}`);
}

function buildCareerRoleIdentityKey(role: z.infer<typeof careerRoleIdentitySchema>): string {
  return normalizeText(`${role.seniority}:${role.roleName}`);
}

function buildTreeRows(
  nodes: ComposerVisibleNode[],
  parentAnchorRef: string | null = null,
  depth = 0,
): Array<{
  anchorRef: string;
  parentAnchorRef: string | null;
  depth: number;
}> {
  return nodes.flatMap((node) => [
    {
      anchorRef: node.anchorRef,
      parentAnchorRef,
      depth,
    },
    ...buildTreeRows(node.children, node.anchorRef, depth + 1),
  ]);
}

function collectVisibleNodeTitles(nodes: ComposerVisibleNode[]): string[] {
  return nodes.flatMap((node) => [node.title, ...collectVisibleNodeTitles(node.children)]);
}

function flattenVisibleNodes(nodes: ComposerVisibleNode[]): ComposerVisibleNode[] {
  return nodes.flatMap((node) => [node, ...flattenVisibleNodes(node.children)]);
}

function validateCareerRoleIdentity(params: {
  role: z.infer<typeof careerRoleIdentitySchema>;
  label: string;
  keySeed: string;
}) {
  const normalizedRoleName = normalizeText(params.role.roleName);
  if (!normalizedRoleName) {
    throw new Error(`Growth compose metadata returned empty roleName for ${params.keySeed}`);
  }
  const roleTitle = formatCareerRoleTitle(params.role);
  if (!CHINESE_TEXT_PATTERN.test(roleTitle)) {
    throw new Error(
      `Growth compose metadata returned non-Chinese ${params.label} "${roleTitle}" for ${params.keySeed}`,
    );
  }

  for (const term of FORBIDDEN_NON_ROLE_TITLE_TERMS) {
    if (params.role.roleName.includes(term) || params.role.specialization?.includes(term)) {
      throw new Error(
        `Growth compose metadata returned non-role ${params.label} "${formatCareerRoleTitle(
          params.role,
        )}" containing "${term}" for ${params.keySeed}`,
      );
    }
  }

  for (const term of FORBIDDEN_ROLE_NAME_SENIORITY_TERMS) {
    if (params.role.roleName.includes(term)) {
      throw new Error(
        `Growth compose metadata put seniority inside roleName "${params.role.roleName}" for ${params.keySeed}`,
      );
    }
  }
}

function validateNodeLabel(params: { label: z.infer<typeof nodeMetadataSchema>; keySeed: string }) {
  if (RAW_INTERNAL_LABEL_PATTERN.test(params.label.title)) {
    throw new Error(
      `Growth compose metadata returned raw internal node label "${params.label.title}" for ${params.keySeed}`,
    );
  }

  const normalizedTitle = normalizeText(params.label.title);
  if (!normalizedTitle) {
    throw new Error(`Growth compose metadata returned empty node label for ${params.keySeed}`);
  }
  if (!CHINESE_TEXT_PATTERN.test(params.label.title)) {
    throw new Error(
      `Growth compose metadata returned non-Chinese node label "${params.label.title}" for ${params.keySeed}`,
    );
  }
}

function validateMetadataOutput(params: {
  output: unknown;
  requestedDirection: {
    keySeed: string;
    confidence: number;
    tree: ComposerVisibleNode[];
  };
}): GrowthDirectionMetadata {
  const parsed = directionMetadataOutputSchema.parse(params.output);
  const currentCareerRole = parsed.currentCareerRole;
  validateCareerRoleIdentity({
    role: currentCareerRole.role,
    label: "current career role",
    keySeed: params.requestedDirection.keySeed,
  });

  const currentCareerTitle = formatCareerRoleTitle(currentCareerRole.role);
  const normalizedTitle = normalizeText(currentCareerTitle);
  if (!normalizedTitle) {
    throw new Error(
      `Growth compose metadata returned empty title for ${params.requestedDirection.keySeed}`,
    );
  }
  const forbiddenTitleTerm = FORBIDDEN_DIRECTION_TITLE_TERMS.find((term) =>
    currentCareerTitle.includes(term),
  );
  if (forbiddenTitleTerm) {
    throw new Error(
      `Growth compose metadata returned non-career title "${currentCareerTitle}" containing "${forbiddenTitleTerm}" for ${params.requestedDirection.keySeed}`,
    );
  }
  const nonRoleTitleTerm = FORBIDDEN_NON_ROLE_TITLE_TERMS.find((term) =>
    currentCareerTitle.includes(term),
  );
  if (nonRoleTitleTerm) {
    throw new Error(
      `Growth compose metadata returned non-role title "${currentCareerTitle}" containing "${nonRoleTitleTerm}" for ${params.requestedDirection.keySeed}`,
    );
  }
  const capabilityTitles = new Set(
    collectVisibleNodeTitles(params.requestedDirection.tree).map(normalizeText).filter(Boolean),
  );
  if (capabilityTitles.has(normalizedTitle)) {
    throw new Error(
      `Growth compose metadata copied a capability title as career title: ${currentCareerTitle}`,
    );
  }

  const allowedAnchorRefs = new Set(collectComposerAnchorRefs(params.requestedDirection.tree));
  const visibleNodeMap = new Map(
    flattenVisibleNodes(params.requestedDirection.tree).map((node) => [node.anchorRef, node]),
  );
  const seenAnchorRefs = new Set<string>();
  const labeledAnchorRefs = new Set<string>();
  const nodeLabels = [...parsed.nodeLabels];

  for (const nodeLabel of nodeLabels) {
    if (!allowedAnchorRefs.has(nodeLabel.anchorRef)) {
      throw new Error(
        `Growth compose metadata returned unknown node label anchorRef ${nodeLabel.anchorRef} for ${params.requestedDirection.keySeed}`,
      );
    }
    validateNodeLabel({
      label: nodeLabel,
      keySeed: params.requestedDirection.keySeed,
    });
    if (seenAnchorRefs.has(nodeLabel.anchorRef)) {
      throw new Error(
        `Growth compose metadata returned duplicate node label anchorRef ${nodeLabel.anchorRef} for ${params.requestedDirection.keySeed}`,
      );
    }
    seenAnchorRefs.add(nodeLabel.anchorRef);
    labeledAnchorRefs.add(nodeLabel.anchorRef);
  }

  for (const anchorRef of allowedAnchorRefs) {
    if (!labeledAnchorRefs.has(anchorRef)) {
      const visibleNode = visibleNodeMap.get(anchorRef);
      if (!visibleNode) {
        throw new Error(
          `Growth compose metadata missed unknown node label anchorRef ${anchorRef} for ${params.requestedDirection.keySeed}`,
        );
      }

      const existingLabel = {
        anchorRef,
        title: visibleNode.title,
        summary: visibleNode.summary,
      };
      validateNodeLabel({
        label: existingLabel,
        keySeed: params.requestedDirection.keySeed,
      });
      nodeLabels.push(existingLabel);
    }
  }

  const normalizedRoleTitles = new Set<string>();
  for (const role of parsed.progressionRoles) {
    validateCareerRoleIdentity({
      role: role.role,
      label: "progression role",
      keySeed: params.requestedDirection.keySeed,
    });

    const roleTitle = formatCareerRoleTitle(role.role);
    const normalizedRoleTitle = normalizeText(roleTitle);
    if (!normalizedRoleTitle) {
      throw new Error(
        `Growth compose metadata returned empty progression role title for ${params.requestedDirection.keySeed}`,
      );
    }
    if (normalizedRoleTitle === normalizedTitle || normalizedRoleTitles.has(normalizedRoleTitle)) {
      throw new Error(
        `Growth compose metadata returned duplicate progression role title "${roleTitle}" for ${params.requestedDirection.keySeed}`,
      );
    }
    const nonRoleProgressionTerm = FORBIDDEN_NON_ROLE_TITLE_TERMS.find((term) =>
      roleTitle.includes(term),
    );
    if (nonRoleProgressionTerm) {
      throw new Error(
        `Growth compose metadata returned non-role progression title "${roleTitle}" containing "${nonRoleProgressionTerm}" for ${params.requestedDirection.keySeed}`,
      );
    }
    if (SENIORITY_RANK[role.role.seniority] <= SENIORITY_RANK[currentCareerRole.role.seniority]) {
      throw new Error(
        `Growth compose metadata returned non-progressive role "${roleTitle}" for current role "${currentCareerTitle}" in ${params.requestedDirection.keySeed}`,
      );
    }
    normalizedRoleTitles.add(normalizedRoleTitle);

    for (const nodeRef of role.supportingNodeRefs) {
      if (!allowedAnchorRefs.has(nodeRef)) {
        throw new Error(
          `Growth compose metadata returned progression role ${role.id} with unknown supporting node ${nodeRef} for ${params.requestedDirection.keySeed}`,
        );
      }
    }
  }

  return {
    keySeed: params.requestedDirection.keySeed,
    roleIdentityKey: buildCareerRoleIdentityKey(currentCareerRole.role),
    title: currentCareerTitle,
    summary: currentCareerRole.summary,
    whyThisDirection: currentCareerRole.whyThisDirection,
    progressionRoles: parsed.progressionRoles.map((role) => ({
      id: role.id,
      title: formatCareerRoleTitle(role.role),
      summary: role.summary,
      horizon: role.horizon,
      confidence: role.confidence,
      supportingNodeRefs: role.supportingNodeRefs,
    })),
    nodeLabels,
  };
}

function sumUsage(
  results: Array<{
    usage?: {
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
    };
  }>,
) {
  const inputTokens = results.reduce((sum, result) => sum + (result.usage?.inputTokens ?? 0), 0);
  const outputTokens = results.reduce((sum, result) => sum + (result.usage?.outputTokens ?? 0), 0);
  const totalTokens = results.reduce((sum, result) => {
    const usage = result.usage;
    return sum + (usage?.totalTokens ?? (usage?.inputTokens ?? 0) + (usage?.outputTokens ?? 0));
  }, 0);

  return {
    inputTokens,
    outputTokens,
    totalTokens: totalTokens || inputTokens + outputTokens,
  };
}

export async function composeGrowthDirectionMetadata(params: {
  userId: string;
  graph: ComposeGraph;
  directions: Array<{
    keySeed: string;
    matchPreviousDirectionKey?: string;
    supportingNodeRefs: string[];
    confidence: number;
    tree: ComposerVisibleNode[];
  }>;
  recordUsage?: boolean;
}): Promise<GrowthDirectionMetadata[]> {
  const startedAt = Date.now();
  const telemetry = createTelemetryContext({
    endpoint: "growth:compose:metadata",
    intent: "growth-compose-metadata",
    workflow: "growth",
    modelPolicy: "section-draft",
    promptVersion: GROWTH_COMPOSE_METADATA_PROMPT_VERSION,
    userId: params.userId,
    metadata: {
      directionCount: params.directions.length,
      nodeCount: params.graph.nodes.length,
    },
  });

  try {
    const graphNodeMap = new Map(params.graph.nodes.map((node) => [node.id, node]));
    const results = await Promise.all(
      params.directions.map(async (direction) => {
        const usages: Array<{ usage?: Parameters<typeof sumUsage>[0][number]["usage"] }> = [];
        let validationError: string | null = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          const result = await generateText({
            model: getPlainModelForPolicy("section-draft"),
            output: Output.object({ schema: directionMetadataOutputSchema }),
            system: GROWTH_COMPOSE_METADATA_SYSTEM_PROMPT,
            prompt: buildGrowthComposeMetadataPrompt({
              validationError,
              direction: {
                keySeed: direction.keySeed,
                matchPreviousDirectionKey: direction.matchPreviousDirectionKey,
                supportingNodeRefs: direction.supportingNodeRefs,
                confidence: direction.confidence,
                visibleNodeCount: collectComposerAnchorRefs(direction.tree).length,
                supportingNodeCount: direction.supportingNodeRefs.length,
                requiredNodeLabelAnchorRefs: collectComposerAnchorRefs(direction.tree),
                nodes: buildTreeRows(direction.tree).map((row) => {
                  const graphNode = graphNodeMap.get(row.anchorRef);
                  return {
                    anchorRef: row.anchorRef,
                    parentAnchorRef: row.parentAnchorRef,
                    depth: row.depth,
                    canonicalLabel: graphNode?.canonicalLabel ?? row.anchorRef,
                    summary: graphNode?.summary ?? null,
                    progress: graphNode?.progress ?? 0,
                    state: graphNode?.state ?? "ready",
                    evidenceScore: graphNode?.evidenceScore ?? 0,
                  };
                }),
              },
            }),
            ...buildGenerationSettingsForPolicy("section-draft", {
              temperature: 0.15,
            }),
            timeout: GROWTH_DIRECTION_METADATA_AI_TIMEOUT_MS,
          });

          usages.push({ usage: result.usage });

          try {
            return {
              usages,
              metadata: validateMetadataOutput({
                output: result.output,
                requestedDirection: direction,
              }),
            };
          } catch (error) {
            validationError = getErrorMessage(error);
            if (attempt === 1) {
              throw error;
            }
          }
        }

        throw new Error(`Growth compose metadata failed for ${direction.keySeed}`);
      }),
    );

    const validated = results.map((result) => result.metadata);

    if (params.recordUsage !== false) {
      await recordAIUsage({
        ...telemetry,
        usage: sumUsage(results.flatMap((result) => result.usages)),
        durationMs: Date.now() - startedAt,
        success: true,
        metadata: {
          ...telemetry.metadata,
          model: GROWTH_COMPOSE_METADATA_MODEL_LABEL,
        },
      });
    }

    return validated;
  } catch (error) {
    if (params.recordUsage !== false) {
      await recordAIUsage({
        ...telemetry,
        durationMs: Date.now() - startedAt,
        success: false,
        errorMessage: getErrorMessage(error),
        metadata: {
          ...telemetry.metadata,
          model: GROWTH_COMPOSE_METADATA_MODEL_LABEL,
        },
      });
    }
    throw error;
  }
}

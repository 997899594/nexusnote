import { desc, eq } from "drizzle-orm";
import { db, knowledgeInsights } from "@/db";
import { getLatestFocusSnapshot } from "@/lib/growth/projection-data";
import { getGrowthSnapshot } from "@/lib/growth/snapshot-data";
import {
  findDefaultFocusNode,
  getCurrentGrowthTree,
  getTreeByDirectionKey,
  resolveProjectedFocusNode,
} from "@/lib/growth/view-model";
import type { GrowthGenerationContext } from "./generation-context-format";

export interface UserGrowthContext extends GrowthGenerationContext {}

export const EMPTY_USER_GROWTH_CONTEXT: UserGrowthContext = {
  currentDirection: null,
  currentFocus: null,
  insights: [],
};

const INTERACTIVE_GROWTH_CONTEXT_BUDGET_MS = 180;

export interface UserGrowthContextBudgetOptions {
  directionKey?: string | null;
  timeoutMs?: number;
  onTimeout?: () => void;
}

function resolveLatestFocusReference(params: {
  activeTree: ReturnType<typeof getCurrentGrowthTree>;
  latestFocusSnapshot: Awaited<ReturnType<typeof getLatestFocusSnapshot>>;
}) {
  const { activeTree, latestFocusSnapshot } = params;
  if (!activeTree || !latestFocusSnapshot) {
    return null;
  }

  if (latestFocusSnapshot.directionKey !== activeTree.directionKey) {
    return null;
  }

  return (
    latestFocusSnapshot.node ?? {
      id: latestFocusSnapshot.nodeId,
      anchorRef: latestFocusSnapshot.anchorRef,
    }
  );
}

function buildCurrentDirection(
  activeTree: ReturnType<typeof getCurrentGrowthTree>,
): UserGrowthContext["currentDirection"] {
  if (!activeTree) {
    return null;
  }

  return {
    directionKey: activeTree.directionKey,
    title: activeTree.title,
    summary: activeTree.summary,
    whyThisDirection: activeTree.whyThisDirection,
  };
}

function resolveActiveGrowthTree(params: {
  snapshot: Awaited<ReturnType<typeof getGrowthSnapshot>>;
  directionKey?: string | null;
}) {
  return (
    getTreeByDirectionKey(params.snapshot, params.directionKey ?? null) ??
    getCurrentGrowthTree(params.snapshot)
  );
}

function buildCurrentFocus(params: {
  activeFocusNode: ReturnType<typeof findDefaultFocusNode>;
  latestFocusSnapshot: Awaited<ReturnType<typeof getLatestFocusSnapshot>>;
}): UserGrowthContext["currentFocus"] {
  if (params.activeFocusNode) {
    return {
      anchorRef: params.activeFocusNode.anchorRef,
      title: params.activeFocusNode.title,
      summary: params.activeFocusNode.summary,
      state: params.activeFocusNode.state,
      progress: params.activeFocusNode.progress,
    };
  }

  if (!params.latestFocusSnapshot) {
    return null;
  }

  return {
    anchorRef: params.latestFocusSnapshot.anchorRef ?? params.latestFocusSnapshot.nodeId,
    title: params.latestFocusSnapshot.title,
    summary: params.latestFocusSnapshot.summary,
    state: params.latestFocusSnapshot.state,
    progress: params.latestFocusSnapshot.progress,
  };
}

export async function getUserGrowthContext(
  userId: string,
  options: { directionKey?: string | null } = {},
): Promise<UserGrowthContext> {
  const [snapshot, latestFocusSnapshot, insightRows] = await Promise.all([
    getGrowthSnapshot(userId),
    getLatestFocusSnapshot(userId),
    db
      .select({
        kind: knowledgeInsights.kind,
        title: knowledgeInsights.title,
        summary: knowledgeInsights.summary,
        confidence: knowledgeInsights.confidence,
      })
      .from(knowledgeInsights)
      .where(eq(knowledgeInsights.userId, userId))
      .orderBy(desc(knowledgeInsights.confidence))
      .limit(4),
  ]);

  const activeTree = resolveActiveGrowthTree({
    snapshot,
    directionKey: options.directionKey,
  });
  const latestFocusReference = resolveLatestFocusReference({
    activeTree,
    latestFocusSnapshot,
  });
  const activeFocusNode = activeTree
    ? (resolveProjectedFocusNode(activeTree.tree, latestFocusReference) ??
      findDefaultFocusNode(activeTree.tree))
    : null;

  return {
    currentDirection: buildCurrentDirection(activeTree),
    currentFocus: buildCurrentFocus({
      activeFocusNode,
      latestFocusSnapshot,
    }),
    insights: insightRows.map((insight) => ({
      kind: insight.kind,
      title: insight.title,
      summary: insight.summary,
      confidence: Number(insight.confidence),
    })),
  };
}

export async function getUserGrowthContextWithinBudget(
  userId: string,
  options: UserGrowthContextBudgetOptions = {},
): Promise<UserGrowthContext | undefined> {
  const timeoutMs = options.timeoutMs ?? INTERACTIVE_GROWTH_CONTEXT_BUDGET_MS;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      getUserGrowthContext(userId, {
        directionKey: options.directionKey,
      }),
      new Promise<undefined>((resolve) => {
        timeout = setTimeout(() => {
          options.onTimeout?.();
          resolve(undefined);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

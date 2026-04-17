import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { getCareerTreesTag, getNotesIndexTag, getProfileStatsTag } from "@/lib/cache/tags";
import type { FocusSnapshotProjection } from "@/lib/growth/projection-types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import type {
  NotesWorkbenchSnapshot,
  NoteWorkbenchItem,
} from "@/lib/knowledge/workbench-projection";
import { getNotesWorkbenchCached } from "@/lib/server/editor-data";
import {
  type GrowthWorkspaceData,
  getGrowthWorkspaceDataCached,
} from "@/lib/server/growth-workspace-data";
import { getUserProfileInsightsCached, type ProfileAIUsageStats } from "@/lib/server/profile-data";

export interface ProfileInsightsOverviewDirection {
  title: string;
  summary: string;
  treesCount: number | null;
  confidence: number | null;
  supportingCoursesCount: number | null;
}

export interface ProfileInsightsOverviewFocus {
  title: string;
  summary: string;
  progress: number | null;
  state: FocusSnapshotProjection["state"] | null;
  relatedMaterialCount: number;
}

export interface ProfileInsightsOverview {
  direction: ProfileInsightsOverviewDirection;
  focus: ProfileInsightsOverviewFocus;
}

export interface ProfileInsightsPageData {
  usage: ProfileAIUsageStats;
  overview: ProfileInsightsOverview | null;
  insights: KnowledgeInsight[];
  focusNotes: NoteWorkbenchItem[];
}

function selectFocusNotes(
  workbenchSnapshot: NotesWorkbenchSnapshot,
  limit: number,
): NoteWorkbenchItem[] {
  const itemById = new Map(workbenchSnapshot.items.map((item) => [item.id, item]));

  return (workbenchSnapshot.focus?.relatedItemIds ?? [])
    .map((itemId) => itemById.get(itemId))
    .filter((item): item is NoteWorkbenchItem => Boolean(item))
    .slice(0, limit);
}

function buildProfileInsightsOverview(
  growth: GrowthWorkspaceData,
  relatedMaterialCount: number,
): ProfileInsightsOverview | null {
  const currentDirection = growth.profileSnapshot?.currentDirection ?? null;
  const focusSnapshot = growth.focusSnapshot;

  if (!currentDirection && !focusSnapshot) {
    return null;
  }

  return {
    direction: {
      title: currentDirection?.title ?? focusSnapshot?.title ?? "成长主线生成中",
      summary: currentDirection?.summary ?? focusSnapshot?.summary ?? "系统正在整理你的成长方向。",
      treesCount: currentDirection
        ? (growth.profileSnapshot?.treesCount ?? growth.snapshot.trees.length)
        : null,
      confidence: currentDirection?.confidence ?? null,
      supportingCoursesCount: currentDirection?.supportingCoursesCount ?? null,
    },
    focus: {
      title: focusSnapshot?.title ?? "当前没有明确焦点",
      summary: focusSnapshot?.summary ?? "随着更多课程、笔记和对话进入系统，这里会稳定显示下一步。",
      progress: focusSnapshot?.progress ?? null,
      state: focusSnapshot?.state ?? null,
      relatedMaterialCount,
    },
  };
}

export async function getProfileInsightsPageDataCached(
  userId: string,
  windowStartIso: string,
): Promise<ProfileInsightsPageData> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getProfileStatsTag(userId));
  cacheTag(getCareerTreesTag(userId));
  cacheTag(getNotesIndexTag(userId));

  const [usage, growth, workbenchSnapshot] = await Promise.all([
    getUserProfileInsightsCached(userId, windowStartIso),
    getGrowthWorkspaceDataCached(userId, 4),
    getNotesWorkbenchCached(userId),
  ]);

  const focusNotes = selectFocusNotes(workbenchSnapshot, 3);
  const relatedMaterialCount = workbenchSnapshot.focus?.relatedItemIds.length ?? 0;

  return {
    usage,
    overview: buildProfileInsightsOverview(growth, relatedMaterialCount),
    insights: growth.insights,
    focusNotes,
  };
}

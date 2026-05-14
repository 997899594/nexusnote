import { tool } from "ai";
import { z } from "zod";
import { getGrowthSnapshot } from "@/lib/growth/snapshot-data";
import {
  flattenVisibleNodes,
  getCurrentGrowthTree,
  getTreeByDirectionKey,
} from "@/lib/growth/view-model";

const LoadCareerContextSchema = z.object({
  directionKey: z.string().min(1).optional(),
});

function summarizeDirectionTree(
  tree: Awaited<ReturnType<typeof getGrowthSnapshot>>["trees"][number],
) {
  const keyNodes = flattenVisibleNodes(tree.tree)
    .slice(0, 8)
    .map((node) => ({
      id: node.id,
      anchorRef: node.anchorRef,
      title: node.title,
      summary: node.summary,
      progress: node.progress,
      state: node.state,
    }));

  return {
    directionKey: tree.directionKey,
    title: tree.title,
    summary: tree.summary,
    confidence: tree.confidence,
    whyThisDirection: tree.whyThisDirection,
    progressionRoles: tree.progressionRoles,
    supportingCourses: tree.supportingCourses.slice(0, 6),
    supportingChapters: tree.supportingChapters.slice(0, 8),
    keyNodes,
  };
}

export function createCareerContextTools(userId: string) {
  return {
    loadCareerContext: tool({
      description:
        "读取当前职业树快照、方向解释、关键技能节点和支撑课程。当用户问适合什么方向、差距在哪、下一步学什么时调用。",
      inputSchema: LoadCareerContextSchema,
      execute: async (args) => {
        try {
          const snapshot = await getGrowthSnapshot(userId);

          if (snapshot.status !== "ready") {
            return {
              success: true,
              status: snapshot.status,
              recommendedDirectionKey: snapshot.recommendedDirectionKey,
              selectedDirectionKey: snapshot.selectedDirectionKey,
              currentDirection: null,
              directions: [],
              message:
                snapshot.status === "empty"
                  ? "还没有已保存课程，职业树为空。"
                  : "职业树正在生成中。",
            };
          }

          const currentTree =
            getTreeByDirectionKey(snapshot, args.directionKey ?? null) ??
            getCurrentGrowthTree(snapshot);

          return {
            success: true,
            status: snapshot.status,
            recommendedDirectionKey: snapshot.recommendedDirectionKey,
            selectedDirectionKey: snapshot.selectedDirectionKey,
            directions: snapshot.trees.map((tree) => ({
              directionKey: tree.directionKey,
              title: tree.title,
              summary: tree.summary,
              confidence: tree.confidence,
              whyThisDirection: tree.whyThisDirection,
            })),
            currentDirection: currentTree ? summarizeDirectionTree(currentTree) : null,
          };
        } catch (error) {
          console.error("[Tool] loadCareerContext error:", error);
          return {
            success: false,
            error: "职业树上下文暂时不可用",
          };
        }
      },
    }),
  };
}

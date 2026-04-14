import { eq, inArray } from "drizzle-orm";
import {
  careerGenerationRuns,
  careerUserSkillNodes,
  db,
  knowledgeEvidence,
  knowledgeInsightEvidence,
  knowledgeInsights,
} from "@/db";
import {
  revalidateGoldenPath,
  revalidateNotesIndex,
  revalidateProfileStats,
} from "@/lib/cache/tags";
import type { CareerTreeJobData } from "@/lib/queue/career-tree-queue";

type JobPayload<T extends CareerTreeJobData["type"]> = Extract<CareerTreeJobData, { type: T }>;

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCaseLike(value: string): string {
  return value.split(" ").filter(Boolean).slice(0, 6).join(" ");
}

export async function processKnowledgeInsightsJob(
  job: JobPayload<"derive_user_insights">,
): Promise<void> {
  const evidenceRows = await db
    .select({
      id: knowledgeEvidence.id,
      title: knowledgeEvidence.title,
      summary: knowledgeEvidence.summary,
      confidence: knowledgeEvidence.confidence,
      kind: knowledgeEvidence.kind,
    })
    .from(knowledgeEvidence)
    .where(eq(knowledgeEvidence.userId, job.userId));

  const skillNodes = await db
    .select({
      id: careerUserSkillNodes.id,
      canonicalLabel: careerUserSkillNodes.canonicalLabel,
      progress: careerUserSkillNodes.progress,
      state: careerUserSkillNodes.state,
      evidenceScore: careerUserSkillNodes.evidenceScore,
    })
    .from(careerUserSkillNodes)
    .where(eq(careerUserSkillNodes.userId, job.userId));

  const groupedThemes = new Map<
    string,
    { title: string; summary: string; confidence: number; evidenceIds: string[] }
  >();

  for (const row of evidenceRows) {
    const key = normalizeLabel(row.title);
    if (!key) {
      continue;
    }

    const current = groupedThemes.get(key) ?? {
      title: titleCaseLike(row.title),
      summary: row.summary,
      confidence: 0,
      evidenceIds: [],
    };

    current.confidence += Number(row.confidence);
    current.evidenceIds.push(row.id);
    groupedThemes.set(key, current);
  }

  const themeInsights = [...groupedThemes.values()]
    .sort((left, right) => right.confidence - left.confidence)
    .slice(0, 5)
    .map((theme) => ({
      kind: "theme" as const,
      title: theme.title,
      summary: theme.summary,
      confidence: Math.min(1, theme.confidence / Math.max(1, theme.evidenceIds.length)),
      evidenceIds: theme.evidenceIds,
    }));

  const strengthInsights = skillNodes
    .filter((node) => node.progress >= 70)
    .sort((left, right) => right.progress - left.progress)
    .slice(0, 3)
    .map((node) => ({
      kind: "strength" as const,
      title: node.canonicalLabel,
      summary: "这是当前最稳定生长的能力分支。",
      confidence: Math.min(1, node.progress / 100),
      evidenceIds: [] as string[],
    }));

  const gapInsights = skillNodes
    .filter((node) => node.state === "ready" || node.state === "locked")
    .sort((left, right) => right.evidenceScore - left.evidenceScore)
    .slice(0, 3)
    .map((node) => ({
      kind: "gap" as const,
      title: node.canonicalLabel,
      summary: "这是当前最值得优先补齐的能力缺口。",
      confidence: Math.min(1, Math.max(node.evidenceScore, 30) / 100),
      evidenceIds: [] as string[],
    }));

  const insights = [...themeInsights, ...strengthInsights, ...gapInsights];

  const [run] = await db
    .insert(careerGenerationRuns)
    .values({
      userId: job.userId,
      kind: "insight",
      status: "succeeded",
      idempotencyKey: `insight:user:${job.userId}:${Date.now()}`,
      model: "heuristic",
      promptVersion: "insight-derive@v1",
      inputHash: `${evidenceRows.length}:${skillNodes.length}`,
      outputJson: insights,
      startedAt: new Date(),
      finishedAt: new Date(),
    })
    .returning({ id: careerGenerationRuns.id });

  await db.transaction(async (tx) => {
    const existingInsights = await tx
      .select({ id: knowledgeInsights.id })
      .from(knowledgeInsights)
      .where(eq(knowledgeInsights.userId, job.userId));

    if (existingInsights.length > 0) {
      await tx.delete(knowledgeInsightEvidence).where(
        inArray(
          knowledgeInsightEvidence.insightId,
          existingInsights.map((row) => row.id),
        ),
      );

      await tx.delete(knowledgeInsights).where(eq(knowledgeInsights.userId, job.userId));
    }

    if (insights.length === 0) {
      return;
    }

    const inserted = await tx
      .insert(knowledgeInsights)
      .values(
        insights.map((insight) => ({
          userId: job.userId,
          kind: insight.kind,
          title: insight.title,
          summary: insight.summary,
          confidence: insight.confidence.toFixed(3),
          createdByRunId: run.id,
        })),
      )
      .returning({
        id: knowledgeInsights.id,
      });

    const links = inserted.flatMap((row, index) =>
      insights[index].evidenceIds.map((evidenceId) => ({
        insightId: row.id,
        evidenceId,
        weight: "1.000",
      })),
    );

    if (links.length > 0) {
      await tx.insert(knowledgeInsightEvidence).values(links);
    }
  });

  revalidateGoldenPath(job.userId);
  revalidateProfileStats(job.userId);
  revalidateNotesIndex(job.userId);
}

import { desc, eq } from "drizzle-orm";
import { db, knowledgeInsights } from "@/db";
import { knowledgeInsightSchema } from "./types";

export * from "./derive";
export * from "./types";

export async function listUserKnowledgeInsights(userId: string, limit?: number) {
  const query = db
    .select({
      id: knowledgeInsights.id,
      kind: knowledgeInsights.kind,
      title: knowledgeInsights.title,
      summary: knowledgeInsights.summary,
      confidence: knowledgeInsights.confidence,
      metadata: knowledgeInsights.metadata,
    })
    .from(knowledgeInsights)
    .where(eq(knowledgeInsights.userId, userId))
    .orderBy(desc(knowledgeInsights.confidence), desc(knowledgeInsights.updatedAt));
  const rows = typeof limit === "number" ? await query.limit(limit) : await query;

  return rows.map((row) =>
    knowledgeInsightSchema.parse({
      id: row.id,
      userId,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      confidence: Number(row.confidence),
      metadata: row.metadata ?? {},
    }),
  );
}

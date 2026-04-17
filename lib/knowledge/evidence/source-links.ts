import { inArray } from "drizzle-orm";
import { db, knowledgeEvidenceSourceLinks } from "@/db";

type EvidenceSourceLinkExecutor = Pick<typeof db, "select">;

export interface EvidenceSourceLinkRow {
  evidenceId: string;
  refType: string;
  refId: string;
  snippet: string | null;
  weight: string;
}

export async function listEvidenceSourceLinks(params: {
  executor?: EvidenceSourceLinkExecutor;
  evidenceIds: string[];
}): Promise<EvidenceSourceLinkRow[]> {
  if (params.evidenceIds.length === 0) {
    return [];
  }

  const executor = params.executor ?? db;

  return executor
    .select({
      evidenceId: knowledgeEvidenceSourceLinks.evidenceId,
      refType: knowledgeEvidenceSourceLinks.refType,
      refId: knowledgeEvidenceSourceLinks.refId,
      snippet: knowledgeEvidenceSourceLinks.snippet,
      weight: knowledgeEvidenceSourceLinks.weight,
    })
    .from(knowledgeEvidenceSourceLinks)
    .where(inArray(knowledgeEvidenceSourceLinks.evidenceId, params.evidenceIds));
}

export function groupEvidenceSourceLinksByEvidenceId<T extends { evidenceId: string }>(
  rows: T[],
): Map<string, T[]> {
  const rowsByEvidenceId = new Map<string, T[]>();

  for (const row of rows) {
    const existingRows = rowsByEvidenceId.get(row.evidenceId) ?? [];
    existingRows.push(row);
    rowsByEvidenceId.set(row.evidenceId, existingRows);
  }

  return rowsByEvidenceId;
}

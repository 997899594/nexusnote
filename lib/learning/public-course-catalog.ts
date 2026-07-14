import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { coursePublicationSnapshots, coursePublications, db } from "@/db";
import { getPublicCourseCatalogTag } from "@/lib/cache/tags";

export interface PublicCourseCatalogItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  publishedAt: string | null;
  ownerName: string | null;
  chapterCount: number;
}

export async function getPublicCourseCatalog(
  limit = 24,
  offset = 0,
): Promise<PublicCourseCatalogItem[]> {
  "use cache";

  cacheLife("hours");
  cacheTag(getPublicCourseCatalogTag());

  const rows = await db
    .select({
      id: coursePublications.id,
      slug: coursePublications.slug,
      title: coursePublications.title,
      description: coursePublications.description,
      publishedAt: coursePublications.publishedAt,
      ownerName: sql<
        string | null
      >`(SELECT name FROM users WHERE users.id = ${coursePublications.ownerUserId})`,
      chapterCount: sql<number>`jsonb_array_length(${coursePublicationSnapshots.contentJson}->'outline'->'chapters')`,
    })
    .from(coursePublications)
    .innerJoin(
      coursePublicationSnapshots,
      eq(coursePublications.currentSnapshotId, coursePublicationSnapshots.id),
    )
    .where(eq(coursePublications.status, "published"))
    .orderBy(desc(coursePublications.publishedAt))
    .limit(Math.min(Math.max(limit, 1), 50))
    .offset(Math.max(offset, 0));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    ownerName: row.ownerName,
    chapterCount: Number(row.chapterCount) || 0,
  }));
}

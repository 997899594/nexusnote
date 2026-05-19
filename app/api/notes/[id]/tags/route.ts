/**
 * Note Tags API
 *
 * GET  - 获取笔记的所有标签
 * POST - 触发标签生成
 */

import { and, eq, ne } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { noteTags, tags } from "@/db/schema";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";
import { notFound, withDynamicAuth } from "@/lib/api";
import { getOwnedNote } from "@/lib/notes/repository";

async function getOwnedRouteNote(
  noteId: string,
  userId: string,
): Promise<{ noteId: string; note: Awaited<ReturnType<typeof getOwnedNote>> }> {
  const note = await getOwnedNote(noteId, userId);
  return { noteId, note };
}

// GET /api/notes/[id]/tags
export const GET = withDynamicAuth<unknown, { id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    const { noteId, note } = await getOwnedRouteNote(params.id, userId);
    if (!note) {
      throw notFound("笔记不存在或无权访问", "NOTE_NOT_FOUND");
    }

    const result = await db
      .select({
        id: noteTags.id,
        confidence: noteTags.confidence,
        status: noteTags.status,
        confirmedAt: noteTags.confirmedAt,
        tag: {
          id: tags.id,
          name: tags.name,
          usageCount: tags.usageCount,
        },
      })
      .from(noteTags)
      .innerJoin(tags, eq(noteTags.tagId, tags.id))
      .where(and(eq(noteTags.noteId, noteId), ne(noteTags.status, "rejected")));

    return NextResponse.json({ tags: result });
  },
);

// POST /api/notes/[id]/tags
export const POST = withDynamicAuth<unknown, { id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    const { noteId, note } = await getOwnedRouteNote(params.id, userId);
    if (!note) {
      throw notFound("笔记不存在或无权访问", "NOTE_NOT_FOUND");
    }

    await tagGenerationService.generateTags(noteId);
    return NextResponse.json({ success: true });
  },
);

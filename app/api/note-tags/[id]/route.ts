/**
 * Note Tag Operations API
 */

import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { notes, noteTags } from "@/db/schema";
import { notFound, parseJsonBodyAs, withDynamicAuth } from "@/lib/api";
import { syncTagUsageCount } from "@/lib/tags/usage-count";

const UpdateNoteTagSchema = z.object({
  status: z.enum(["confirmed", "rejected"]),
});

async function getOwnedNoteTag(noteTagId: string, userId: string) {
  const [result] = await db
    .select({
      id: noteTags.id,
      tagId: noteTags.tagId,
      status: noteTags.status,
    })
    .from(noteTags)
    .innerJoin(notes, eq(noteTags.noteId, notes.id))
    .where(and(eq(noteTags.id, noteTagId), eq(notes.userId, userId)))
    .limit(1);

  return result;
}

async function getOwnedRouteNoteTag(
  noteTagId: string,
  userId: string,
): Promise<{
  noteTagId: string;
  ownedTag: Awaited<ReturnType<typeof getOwnedNoteTag>>;
}> {
  const ownedTag = await getOwnedNoteTag(noteTagId, userId);
  return { noteTagId, ownedTag };
}

// PATCH /api/note-tags/[id]
export const PATCH = withDynamicAuth<unknown, { id: string }>(
  async (request: NextRequest, { userId, params }) => {
    const { noteTagId, ownedTag } = await getOwnedRouteNoteTag(params.id, userId);
    if (!ownedTag) {
      throw notFound("标签关联不存在或无权访问", "NOTE_TAG_NOT_FOUND");
    }

    const { status } = await parseJsonBodyAs(request, UpdateNoteTagSchema);

    const updateData =
      status === "confirmed" ? { status, confirmedAt: new Date() } : { status, confirmedAt: null };

    const [updated] = await db.transaction(async (tx) => {
      const [next] = await tx
        .update(noteTags)
        .set(updateData)
        .where(eq(noteTags.id, noteTagId))
        .returning();

      if (!next) {
        return [];
      }

      await syncTagUsageCount(tx, ownedTag.tagId);

      return [next];
    });

    if (!updated) {
      throw notFound("标签关联不存在", "NOTE_TAG_NOT_FOUND");
    }

    return Response.json({ success: true, noteTag: updated });
  },
);

// DELETE /api/note-tags/[id]
export const DELETE = withDynamicAuth<unknown, { id: string }>(
  async (_request: NextRequest, { userId, params }) => {
    const { noteTagId, ownedTag } = await getOwnedRouteNoteTag(params.id, userId);
    if (!ownedTag) {
      throw notFound("标签关联不存在或无权访问", "NOTE_TAG_NOT_FOUND");
    }

    const [deleted] = await db.transaction(async (tx) => {
      const [next] = await tx.delete(noteTags).where(eq(noteTags.id, noteTagId)).returning();
      if (!next) {
        return [];
      }

      await syncTagUsageCount(tx, ownedTag.tagId);

      return [next];
    });
    if (!deleted) {
      throw notFound("标签关联不存在", "NOTE_TAG_NOT_FOUND");
    }

    return Response.json({ success: true });
  },
);

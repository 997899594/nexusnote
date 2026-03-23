/**
 * Note Tag Operations API
 */

import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notes, noteTags } from "@/db/schema";
import { auth } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getOwnedNoteTag(noteTagId: string, userId: string) {
  const [result] = await db
    .select({
      id: noteTags.id,
    })
    .from(noteTags)
    .innerJoin(notes, eq(noteTags.noteId, notes.id))
    .where(and(eq(noteTags.id, noteTagId), eq(notes.userId, userId)))
    .limit(1);

  return result;
}

// PATCH /api/note-tags/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: noteTagId } = await params;

  try {
    const ownedTag = await getOwnedNoteTag(noteTagId, session.user.id);
    if (!ownedTag) {
      return NextResponse.json({ error: "标签关联不存在或无权访问" }, { status: 404 });
    }

    const body = await request.json();
    const { status } = body as { status: "confirmed" | "rejected" };
    if (!["confirmed", "rejected"].includes(status)) {
      return NextResponse.json({ error: "无效的 status 值" }, { status: 400 });
    }

    const updateData =
      status === "confirmed" ? { status, confirmedAt: new Date() } : { status, confirmedAt: null };
    const [updated] = await db
      .update(noteTags)
      .set(updateData)
      .where(eq(noteTags.id, noteTagId))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "标签关联不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true, noteTag: updated });
  } catch (_error) {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE /api/note-tags/[id]
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: noteTagId } = await params;

  try {
    const ownedTag = await getOwnedNoteTag(noteTagId, session.user.id);
    if (!ownedTag) {
      return NextResponse.json({ error: "标签关联不存在或无权访问" }, { status: 404 });
    }

    const [deleted] = await db.delete(noteTags).where(eq(noteTags.id, noteTagId)).returning();
    if (!deleted) {
      return NextResponse.json({ error: "标签关联不存在" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

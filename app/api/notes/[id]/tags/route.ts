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
import { auth } from "@/lib/auth";
import { getOwnedNote } from "@/lib/notes/repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function getOwnedRouteNote(
  params: RouteParams["params"],
  userId: string,
): Promise<{ noteId: string; note: Awaited<ReturnType<typeof getOwnedNote>> }> {
  const { id: noteId } = await params;
  const note = await getOwnedNote(noteId, userId);
  return { noteId, note };
}

// GET /api/notes/[id]/tags
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { noteId, note } = await getOwnedRouteNote(params, session.user.id);
    if (!note) {
      return NextResponse.json({ error: "笔记不存在或无权访问" }, { status: 404 });
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
  } catch (error) {
    console.error("[API] 获取标签失败:", error);
    return NextResponse.json({ error: "获取标签失败" }, { status: 500 });
  }
}

// POST /api/notes/[id]/tags
export async function POST(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { noteId, note } = await getOwnedRouteNote(params, session.user.id);
    if (!note) {
      return NextResponse.json({ error: "笔记不存在或无权访问" }, { status: 404 });
    }

    await tagGenerationService.generateTags(noteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] 生成标签失败:", error);
    return NextResponse.json({ error: "生成标签失败" }, { status: 500 });
  }
}

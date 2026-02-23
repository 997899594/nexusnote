/**
 * Chat Session API - Single Session Operations
 *
 * GET: 获取会话详情
 * PATCH: 更新会话（标题、消息、归档状态）
 * DELETE: 删除会话
 */

import type { UIMessage } from "ai";
import { NextResponse } from "next/server";
import { conversations, db, eq } from "@/db";
import { auth } from "@/lib/auth";

interface UpdateSessionBody {
  title?: string;
  messages?: UIMessage[];
  summary?: string;
  isArchived?: boolean;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id;

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);

    if (!conv) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (userId && conv.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ session: conv });
  } catch (error) {
    console.error("[ChatSession] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch session" }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id;

    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (userId && existing.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body: UpdateSessionBody = await request.json();
    const { title, messages, summary, isArchived } = body;

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (title !== undefined) updates.title = title;
    if (messages !== undefined) {
      updates.messages = messages;
      updates.messageCount = messages.length;
      updates.lastMessageAt = new Date();
    }
    if (summary !== undefined) updates.summary = summary;
    if (isArchived !== undefined) updates.isArchived = isArchived;

    const [updated] = await db
      .update(conversations)
      .set(updates)
      .where(eq(conversations.id, id))
      .returning();

    return NextResponse.json({ session: updated });
  } catch (error) {
    console.error("[ChatSession] PATCH error:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const userId = session?.user?.id;

    const [existing] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (userId && existing.userId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await db.delete(conversations).where(eq(conversations.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ChatSession] DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}

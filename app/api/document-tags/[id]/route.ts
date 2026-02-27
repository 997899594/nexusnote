/**
 * Document Tag Operations API
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentTags } from "@/db/schema";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/document-tags/[id]
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: documentTagId } = await params;
  try {
    const body = await request.json();
    const { status } = body as { status: "confirmed" | "rejected" };
    if (!["confirmed", "rejected"].includes(status)) {
      return NextResponse.json({ error: "无效的 status 值" }, { status: 400 });
    }
    const updateData = status === "confirmed" ? { status, confirmedAt: new Date() } : { status, confirmedAt: null };
    const [updated] = await db.update(documentTags).set(updateData).where(eq(documentTags.id, documentTagId)).returning();
    if (!updated) return NextResponse.json({ error: "标签关联不存在" }, { status: 404 });
    return NextResponse.json({ success: true, documentTag: updated });
  } catch (error) {
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

// DELETE /api/document-tags/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: documentTagId } = await params;
  try {
    const [deleted] = await db.delete(documentTags).where(eq(documentTags.id, documentTagId)).returning();
    if (!deleted) return NextResponse.json({ error: "标签关联不存在" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

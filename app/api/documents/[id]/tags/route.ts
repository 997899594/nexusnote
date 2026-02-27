/**
 * Document Tags API
 *
 * GET  - 获取文档的所有标签
 * POST - 触发标签生成
 */

import { and, eq, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documentTags, tags } from "@/db/schema";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/documents/[id]/tags
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: documentId } = await params;

  try {
    const result = await db
      .select({
        id: documentTags.id,
        confidence: documentTags.confidence,
        status: documentTags.status,
        confirmedAt: documentTags.confirmedAt,
        tag: {
          id: tags.id,
          name: tags.name,
          usageCount: tags.usageCount,
        },
      })
      .from(documentTags)
      .innerJoin(tags, eq(documentTags.tagId, tags.id))
      .where(
        and(eq(documentTags.documentId, documentId), ne(documentTags.status, "rejected"))
      );

    return NextResponse.json({ tags: result });
  } catch (error) {
    console.error("[API] 获取标签失败:", error);
    return NextResponse.json({ error: "获取标签失败" }, { status: 500 });
  }
}

// POST /api/documents/[id]/tags
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: documentId } = await params;

  try {
    await tagGenerationService.generateTags(documentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] 生成标签失败:", error);
    return NextResponse.json({ error: "生成标签失败" }, { status: 500 });
  }
}

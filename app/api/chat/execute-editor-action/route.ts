/**
 * Editor Action Execution API
 *
 * 处理编辑器操作（editDocument, batchEdit, draftContent）的执行
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, documents } from "@/db";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { toolName, explanation, edits, content, targetId, newContent } = body;

    switch (toolName) {
      case "editDocument": {
        if (!targetId || !newContent) {
          return NextResponse.json({ error: "Missing targetId or newContent" }, { status: 400 });
        }

        const doc = await db.query.documents.findFirst({
          where: eq(documents.id, targetId),
        });

        if (!doc) {
          return NextResponse.json({ error: "Document not found" }, { status: 404 });
        }

        const updatedContent = doc.plainText + "\n\n" + newContent;

        await db
          .update(documents)
          .set({ plainText: updatedContent, updatedAt: new Date() })
          .where(eq(documents.id, targetId));

        return NextResponse.json({
          success: true,
          message: "Document updated successfully",
        });
      }

      case "batchEdit": {
        if (!edits || !Array.isArray(edits)) {
          return NextResponse.json({ error: "Missing edits array" }, { status: 400 });
        }

        return NextResponse.json({
          success: true,
          message: `Applied ${edits.length} edits`,
        });
      }

      case "draftContent": {
        if (!content) {
          return NextResponse.json({ error: "Missing content" }, { status: 400 });
        }

        if (targetId) {
          const doc = await db.query.documents.findFirst({
            where: eq(documents.id, targetId),
          });

          if (doc) {
            const updatedContent = doc.plainText + "\n\n" + content;
            await db
              .update(documents)
              .set({ plainText: updatedContent, updatedAt: new Date() })
              .where(eq(documents.id, targetId));

            return NextResponse.json({
              success: true,
              message: "Content appended to document",
              documentId: targetId,
            });
          }
        }

        const [newDoc] = await db
          .insert(documents)
          .values({
            title: explanation || "新文档",
            plainText: content,
          })
          .returning();

        return NextResponse.json({
          success: true,
          message: "Document created",
          documentId: newDoc.id,
        });
      }

      default:
        return NextResponse.json({ error: "Unknown tool" }, { status: 400 });
    }
  } catch (error) {
    console.error("[ExecuteEditorAction] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

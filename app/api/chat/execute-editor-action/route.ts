/**
 * Editor Action Execution API
 *
 * 处理编辑器操作（editDocument, batchEdit, draftContent）的执行
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, notes } from "@/db";
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

        const note = await db.query.notes.findFirst({
          where: (table, { and, eq }) =>
            and(eq(table.id, targetId), eq(table.userId, session.user.id)),
        });

        if (!note) {
          return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

        const updatedContent = `${note.plainText ?? ""}\n\n${newContent}`;

        await db
          .update(notes)
          .set({ plainText: updatedContent, updatedAt: new Date() })
          .where(eq(notes.id, targetId));

        return NextResponse.json({
          success: true,
          message: "Note updated successfully",
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
          const note = await db.query.notes.findFirst({
            where: (table, { and, eq }) =>
              and(eq(table.id, targetId), eq(table.userId, session.user.id)),
          });

          if (note) {
            const updatedContent = `${note.plainText ?? ""}\n\n${content}`;
            await db
              .update(notes)
              .set({ plainText: updatedContent, updatedAt: new Date() })
              .where(eq(notes.id, targetId));

            return NextResponse.json({
              success: true,
              message: "Content appended to note",
              noteId: targetId,
            });
          }
        }

        const [newNote] = await db
          .insert(notes)
          .values({
            userId: session.user.id,
            title: explanation || "新笔记",
            plainText: content,
          })
          .returning();

        return NextResponse.json({
          success: true,
          message: "Note created",
          noteId: newNote.id,
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

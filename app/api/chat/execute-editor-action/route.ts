/**
 * Editor Action Execution API
 *
 * 处理编辑器操作（editDocument, batchEdit, draftContent）的执行
 */

import { eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { db, notes } from "@/db";
import { auth } from "@/lib/auth";
import { htmlToPlainText, plainTextToHtml } from "@/lib/notes/content";
import { indexNote } from "@/lib/rag/chunker";

function appendParagraph(existingHtml: string, content: string) {
  const addition = plainTextToHtml(content);
  if (!addition) {
    return existingHtml;
  }

  return `${existingHtml}${addition}`;
}

async function scheduleNoteIndex(noteId: string, userId: string, plainText: string) {
  if (!plainText.trim()) {
    return;
  }

  indexNote(noteId, plainText, {
    userId,
    metadata: {
      sourceType: "manual_note",
    },
  }).catch((error) => {
    console.error("[ExecuteEditorAction] Failed to index note:", error);
  });
}

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

        const existingHtml = note.contentHtml ?? plainTextToHtml(note.plainText ?? "");
        const contentHtml = appendParagraph(existingHtml, newContent);
        const plainText = htmlToPlainText(contentHtml);

        await db
          .update(notes)
          .set({ contentHtml, plainText, updatedAt: new Date() })
          .where(eq(notes.id, targetId));

        await scheduleNoteIndex(targetId, session.user.id, plainText);

        return NextResponse.json({
          success: true,
          message: "Note updated successfully",
        });
      }

      case "batchEdit": {
        if (!edits || !Array.isArray(edits)) {
          return NextResponse.json({ error: "Missing edits array" }, { status: 400 });
        }

        return NextResponse.json(
          {
            error: "Batch editing is not supported by the current note content model yet",
          },
          { status: 501 },
        );
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
            const existingHtml = note.contentHtml ?? plainTextToHtml(note.plainText ?? "");
            const contentHtml = appendParagraph(existingHtml, content);
            const plainText = htmlToPlainText(contentHtml);
            await db
              .update(notes)
              .set({ contentHtml, plainText, updatedAt: new Date() })
              .where(eq(notes.id, targetId));

            await scheduleNoteIndex(targetId, session.user.id, plainText);

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
            contentHtml: plainTextToHtml(content),
            plainText: content,
          })
          .returning();

        await scheduleNoteIndex(newNote.id, session.user.id, content);

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

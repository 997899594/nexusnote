/**
 * Editor Action Execution API
 *
 * 处理编辑器操作（editDocument, batchEdit, draftContent）的执行
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { appendOwnedNoteText, createOwnedNote, getOwnedNote } from "@/lib/notes/write-service";

async function appendToOwnedNote(params: {
  noteId: string;
  userId: string;
  plainText: string;
}): Promise<boolean> {
  const note = await getOwnedNote(params.noteId, params.userId);
  if (!note) {
    return false;
  }

  await appendOwnedNoteText({
    noteId: params.noteId,
    userId: params.userId,
    plainText: params.plainText,
  });

  return true;
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

        const appended = await appendToOwnedNote({
          noteId: targetId,
          userId: session.user.id,
          plainText: newContent,
        });
        if (!appended) {
          return NextResponse.json({ error: "Note not found" }, { status: 404 });
        }

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

        if (
          targetId &&
          (await appendToOwnedNote({
            noteId: targetId,
            userId: session.user.id,
            plainText: content,
          }))
        ) {
          return NextResponse.json({
            success: true,
            message: "Content appended to note",
            noteId: targetId,
          });
        }

        const newNote = await createOwnedNote({
          userId: session.user.id,
          title: explanation || "新笔记",
          content: {
            kind: "plainText",
            plainText: content,
          },
        });

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

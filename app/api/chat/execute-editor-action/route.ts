/**
 * Editor Action Execution API
 *
 * 处理编辑器操作（editDocument, batchEdit, draftContent）的执行
 */

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, notFound, parseJsonBodyAs, withAuth } from "@/lib/api";
import { getOwnedNote } from "@/lib/notes/repository";
import { appendOwnedNoteText, createOwnedNote } from "@/lib/notes/write-service";

const ExecuteEditorActionSchema = z.object({
  toolName: z.enum(["editDocument", "batchEdit", "draftContent"]),
  explanation: z.string().optional(),
  edits: z.array(z.unknown()).optional(),
  content: z.string().optional(),
  targetId: z.string().optional(),
  newContent: z.string().optional(),
});

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

export const POST = withAuth(async (request: NextRequest, { userId }) => {
  const { toolName, explanation, edits, content, targetId, newContent } = await parseJsonBodyAs(
    request,
    ExecuteEditorActionSchema,
  );

  switch (toolName) {
    case "editDocument": {
      if (!targetId || !newContent) {
        throw badRequest("Missing targetId or newContent", "MISSING_EDIT_TARGET");
      }

      const appended = await appendToOwnedNote({
        noteId: targetId,
        userId,
        plainText: newContent,
      });
      if (!appended) {
        throw notFound("Note not found", "NOTE_NOT_FOUND");
      }

      return NextResponse.json({
        success: true,
        message: "Note updated successfully",
      });
    }

    case "batchEdit": {
      if (!edits || !Array.isArray(edits)) {
        throw badRequest("Missing edits array", "MISSING_EDITS");
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
        throw badRequest("Missing content", "MISSING_CONTENT");
      }

      if (
        targetId &&
        (await appendToOwnedNote({
          noteId: targetId,
          userId,
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
        userId,
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
      throw badRequest("Unknown tool", "VALIDATION_ERROR");
  }
});

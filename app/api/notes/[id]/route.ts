import { z } from "zod";
import { notFound, parseJsonBodyAs, withDynamicAuth } from "@/lib/api";
import { plainTextToHtml } from "@/lib/notes/content";
import { getOwnedNote } from "@/lib/notes/repository";
import { updateOwnedNote } from "@/lib/notes/write-service";

const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  contentHtml: z.string().optional(),
});

export const GET = withDynamicAuth<unknown, { id: string }>(
  async (_request, { userId, params }) => {
    const { id } = params;
    const note = await getOwnedNote(id, userId);

    if (!note) {
      throw notFound("Note not found", "NOTE_NOT_FOUND");
    }

    return Response.json({
      note: {
        id: note.id,
        title: note.title,
        contentHtml: note.contentHtml ?? plainTextToHtml(note.plainText ?? ""),
        plainText: note.plainText ?? "",
        sourceType: note.sourceType,
        sourceContext: note.sourceContext,
        updatedAt: note.updatedAt,
      },
    });
  },
);

export const PATCH = withDynamicAuth<unknown, { id: string }>(
  async (request, { userId, params }) => {
    const input = await parseJsonBodyAs(request, UpdateNoteSchema);
    const { id } = params;
    const existing = await getOwnedNote(id, userId);

    if (!existing) {
      throw notFound("Note not found", "NOTE_NOT_FOUND");
    }

    const updated = await updateOwnedNote({
      noteId: id,
      userId,
      title: input.title,
      content: {
        kind: "html",
        contentHtml: input.contentHtml ?? existing.contentHtml ?? "",
      },
    });

    if (!updated) {
      throw notFound("Note not found", "NOTE_NOT_FOUND");
    }

    return Response.json({ note: updated });
  },
);

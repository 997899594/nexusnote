import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { plainTextToHtml } from "@/lib/notes/content";
import { getOwnedNote } from "@/lib/notes/repository";
import { updateOwnedNote } from "@/lib/notes/write-service";

const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  contentHtml: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const note = await getOwnedNote(id, userId);

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({
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
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = UpdateNoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id } = await params;
  const existing = await getOwnedNote(id, userId);

  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const updated = await updateOwnedNote({
    noteId: id,
    userId,
    title: parsed.data.title,
    content: {
      kind: "html",
      contentHtml: parsed.data.contentHtml ?? existing.contentHtml ?? "",
    },
  });

  if (!updated) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  return NextResponse.json({ note: updated });
}

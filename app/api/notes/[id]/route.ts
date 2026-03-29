import { and, eq } from "drizzle-orm";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, notes } from "@/db";
import { auth } from "@/lib/auth";
import {
  revalidateNoteDetail,
  revalidateNotesIndex,
  revalidateProfileStats,
} from "@/lib/cache/tags";
import { htmlToPlainText, plainTextToHtml } from "@/lib/notes/content";
import { indexNote } from "@/lib/rag/chunker";

const UpdateNoteSchema = z.object({
  title: z.string().min(1).max(200),
  contentHtml: z.string().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function findOwnedNote(noteId: string, userId: string) {
  return db.query.notes.findFirst({
    where: (table, { and, eq }) => and(eq(table.id, noteId), eq(table.userId, userId)),
  });
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const note = await findOwnedNote(id, userId);

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
  const existing = await findOwnedNote(id, userId);

  if (!existing) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  const contentHtml =
    parsed.data.contentHtml ?? existing.contentHtml ?? plainTextToHtml(existing.plainText ?? "");
  const plainText = htmlToPlainText(contentHtml);

  const [updated] = await db
    .update(notes)
    .set({
      title: parsed.data.title,
      contentHtml,
      plainText,
      updatedAt: new Date(),
    })
    .where(and(eq(notes.id, id), eq(notes.userId, userId)))
    .returning({
      id: notes.id,
      title: notes.title,
      contentHtml: notes.contentHtml,
      plainText: notes.plainText,
      updatedAt: notes.updatedAt,
    });

  indexNote(updated.id, updated.plainText ?? "", {
    userId,
    metadata: {
      sourceType: existing.sourceType,
      sourceContext: existing.sourceContext ?? null,
    },
  }).catch((error) => {
    console.error("[Notes API] Failed to index note:", error);
  });

  revalidateNotesIndex(userId);
  revalidateNoteDetail(userId, updated.id);
  revalidateProfileStats(userId);

  return NextResponse.json({ note: updated });
}

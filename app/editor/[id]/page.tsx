import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, notes } from "@/db";
import { requireAuth } from "@/lib/auth";
import { plainTextToHtml } from "@/lib/notes/content";
import EditorPageClient from "./EditorPageClient";

export const dynamic = "force-dynamic";

interface EditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { id } = await params;
  const session = await requireAuth(`/editor/${id}`);
  const note = await db.query.notes.findFirst({
    where: and(eq(notes.id, id), eq(notes.userId, session.user.id)),
  });

  if (!note) {
    notFound();
  }

  return (
    <EditorPageClient
      noteId={note.id}
      initialTitle={note.title}
      initialContentHtml={note.contentHtml ?? plainTextToHtml(note.plainText ?? "")}
      initialUpdatedAt={note.updatedAt?.toISOString() ?? null}
      sourceType={note.sourceType}
      sourceContext={note.sourceContext ?? null}
    />
  );
}

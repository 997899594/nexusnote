import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { plainTextToHtml } from "@/lib/notes/content";
import { getNoteDetailCached } from "@/lib/server/editor-data";
import EditorPageClient from "./EditorPageClient";

interface EditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { id } = await params;
  const session = await requireAuth(`/editor/${id}`);
  const note = await getNoteDetailCached(session.user.id, id);

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

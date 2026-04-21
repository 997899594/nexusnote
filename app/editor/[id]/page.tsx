import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireDynamicPageAuth } from "@/lib/auth/page";
import { getNoteDetailCached } from "@/lib/knowledge/workbench-data";
import { plainTextToHtml } from "@/lib/notes/content";
import EditorPageClient from "./EditorPageClient";

interface EditorPageProps {
  params: Promise<{ id: string }>;
}

async function EditorPageContent({ params }: EditorPageProps) {
  const { id } = await params;
  const session = await requireDynamicPageAuth(`/editor/${id}`);
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

export default function EditorPage({ params }: EditorPageProps) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f3f4f6]" />}>
      <EditorPageContent params={params} />
    </Suspense>
  );
}

import { requireAuth } from "@/lib/auth";
import EditorPageClient from "./EditorPageClient";

export const dynamic = "force-dynamic";

interface EditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorPage({ params }: EditorPageProps) {
  const { id } = await params;
  await requireAuth(`/editor/${id}`);
  return <EditorPageClient />;
}

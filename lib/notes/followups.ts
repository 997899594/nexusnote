import { syncNoteKnowledge } from "@/lib/notes/knowledge";
import type { NoteRecord } from "@/lib/notes/repository";

export async function syncNoteCreateKnowledge(note: NoteRecord): Promise<void> {
  await syncNoteKnowledge(note);
}

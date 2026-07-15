import type { Worker } from "bullmq";
import { tagGenerationService } from "@/lib/ai/services/tag-generation-service";
import { syncNoteCreateKnowledge } from "@/lib/notes/followups";
import { getOwnedNote } from "@/lib/notes/repository";
import { createNexusWorker } from "./bullmq";
import type { NoteFollowupsJobData } from "./note-followups-queue";
import { getQueueRuntimePolicy } from "./runtime-policy";

let worker: Worker<NoteFollowupsJobData> | null = null;

export function startNoteFollowupsWorker(): Worker<NoteFollowupsJobData> {
  if (worker) {
    return worker;
  }

  worker = createNexusWorker<NoteFollowupsJobData>(
    "note-followups",
    async (job) => {
      switch (job.data.type) {
        case "sync_note_followups": {
          const note = await getOwnedNote(job.data.noteId, job.data.userId);

          if (!note) {
            throw new Error(`Note followups target is missing: ${job.data.noteId}`);
          }

          await syncNoteCreateKnowledge(note);
          await tagGenerationService.generateTags(note.id);
          break;
        }
      }
    },
    {
      label: "NoteFollowupsWorker",
      concurrency: getQueueRuntimePolicy("noteFollowups").concurrency,
    },
  );

  return worker;
}

import type { Queue } from "bullmq";
import { createNexusQueue } from "@/lib/queue/bullmq";
import { buildSafeJobId } from "@/lib/queue/job-id";
import { getQueueRuntimePolicy } from "@/lib/queue/runtime-policy";

export type NoteFollowupsJobData = {
  type: "sync_note_followups";
  userId: string;
  noteId: string;
};

export interface QueuedNoteFollowupsJob {
  id: string | null;
  name: string;
  type: NoteFollowupsJobData["type"];
}

let noteFollowupsQueue: Queue<NoteFollowupsJobData> | null = null;

export function getNoteFollowupsQueue(): Queue<NoteFollowupsJobData> {
  if (noteFollowupsQueue) {
    return noteFollowupsQueue;
  }

  noteFollowupsQueue = createNexusQueue<NoteFollowupsJobData>(
    "note-followups",
    getQueueRuntimePolicy("noteFollowups"),
  );

  return noteFollowupsQueue;
}

export async function enqueueNoteFollowups(params: {
  userId: string;
  noteId: string;
}): Promise<QueuedNoteFollowupsJob> {
  const job: NoteFollowupsJobData = {
    type: "sync_note_followups",
    userId: params.userId,
    noteId: params.noteId,
  };
  const queued = await getNoteFollowupsQueue().add("sync-note-followups", job, {
    jobId: buildSafeJobId(["note-followups", params.userId, params.noteId]),
  });

  return {
    id: queued.id ?? null,
    name: queued.name,
    type: job.type,
  };
}

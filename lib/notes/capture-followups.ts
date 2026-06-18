import { revalidateNoteWorkspaceViews } from "@/lib/cache/domain-events";
import { buildErrorLogFields, writeStructuredLog } from "@/lib/observability/structured-log";
import { enqueueNoteFollowups } from "@/lib/queue/note-followups-queue";

export async function scheduleCapturedNoteFollowups(params: {
  userId: string;
  noteId: string;
}): Promise<void> {
  revalidateNoteWorkspaceViews(params.userId, params.noteId);

  try {
    await enqueueNoteFollowups(params);
  } catch (error) {
    writeStructuredLog("error", "note_followups_enqueue_failed", {
      userId: params.userId,
      noteId: params.noteId,
      ...buildErrorLogFields(error),
    });
  }
}

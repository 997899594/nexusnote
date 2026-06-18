import { startNoteFollowupsWorker } from "@/lib/queue/note-followups-worker";

startNoteFollowupsWorker();

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

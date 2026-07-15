import { z } from "zod";
import { replayDeadLetterEvent } from "@/lib/operations/outbox-operations";

const eventId = z.string().uuid().parse(process.argv[2]);
const replayed = await replayDeadLetterEvent(eventId);

if (!replayed) {
  throw new Error(`Dead-lettered outbox event not found: ${eventId}`);
}

console.log(JSON.stringify({ eventId, status: "replay_scheduled" }));
process.exit(0);

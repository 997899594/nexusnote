import type { EvidenceEvent } from "./types";

export async function listEvidenceEventsForUser(_userId: string): Promise<EvidenceEvent[]> {
  // Event reads land with the event schema migration.
  return [];
}

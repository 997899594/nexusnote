import { db, runtimeHeartbeats, sql } from "@/db";

const HEARTBEAT_INTERVAL_MS = 15_000;

export function startRuntimeHeartbeat(runtimeName: string): () => void {
  const instanceId = crypto.randomUUID();

  async function beat() {
    await db
      .insert(runtimeHeartbeats)
      .values({
        runtimeName,
        instanceId,
        metadata: { pid: process.pid },
      })
      .onConflictDoUpdate({
        target: runtimeHeartbeats.runtimeName,
        set: {
          instanceId,
          metadata: { pid: process.pid },
          startedAt: sql`now()`,
          lastSeenAt: sql`now()`,
        },
      });
  }

  void beat().catch((error) => console.error(`[${runtimeName}] Heartbeat failed`, error));
  const timer = setInterval(() => {
    void beat().catch((error) => console.error(`[${runtimeName}] Heartbeat failed`, error));
  }, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(timer);
}

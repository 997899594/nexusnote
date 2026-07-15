import { db, runtimeHeartbeats, sql } from "@/db";

const HEARTBEAT_INTERVAL_MS = 15_000;

export function startRuntimeHeartbeat(
  runtimeName: string,
  workerNames: readonly string[],
): () => void {
  const instanceId = crypto.randomUUID();

  async function beat() {
    await db
      .insert(runtimeHeartbeats)
      .values(
        workerNames.map((workerName) => ({
          runtimeName,
          workerName,
          instanceId,
          metadata: { pid: process.pid },
        })),
      )
      .onConflictDoUpdate({
        target: [
          runtimeHeartbeats.runtimeName,
          runtimeHeartbeats.workerName,
          runtimeHeartbeats.instanceId,
        ],
        set: {
          metadata: { pid: process.pid },
          lastSeenAt: sql`now()`,
        },
      });
  }

  void beat().catch((error) => console.error(`[${runtimeName}] Heartbeat failed`, error));
  const timer = setInterval(() => {
    void beat().catch((error) => console.error(`[${runtimeName}] Heartbeat failed`, error));
  }, HEARTBEAT_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    void db
      .delete(runtimeHeartbeats)
      .where(sql`${runtimeHeartbeats.instanceId} = ${instanceId}`)
      .catch((error) => console.error(`[${runtimeName}] Heartbeat cleanup failed`, error));
  };
}

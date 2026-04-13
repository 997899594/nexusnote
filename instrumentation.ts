/**
 * Next.js Instrumentation Hook
 *
 * Starts background services (BullMQ worker) on server startup.
 * Dynamic import avoids pulling BullMQ into edge runtime or build phase.
 */

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build"
  ) {
    const { startCareerTreeWorker } = await import("@/lib/queue/career-tree-worker");
    const { startRagWorker } = await import("@/lib/queue/rag-worker");
    startCareerTreeWorker();
    startRagWorker();
  }
}

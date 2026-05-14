/**
 * Next.js Instrumentation Hook
 *
 * The web runtime intentionally does not start BullMQ workers.
 * Background queues run in explicit worker processes (`bun run worker:*`)
 * or a dedicated platform worker service.
 */

export async function register() {}

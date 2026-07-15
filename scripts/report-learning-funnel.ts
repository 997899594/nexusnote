import { getLearningActivationFunnel } from "@/lib/learning/activation";

const days = Number.parseInt(process.argv[2] ?? "90", 10);
if (!Number.isInteger(days) || days <= 0) {
  throw new Error("Usage: bun run learning:funnel [positive-day-window]");
}

const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
const cohorts = await getLearningActivationFunnel(since);

console.log(JSON.stringify({ since: since.toISOString(), cohorts }, null, 2));
process.exit(0);

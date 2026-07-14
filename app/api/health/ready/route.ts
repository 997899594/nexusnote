import { createHealthResponse, getReadinessReport } from "@/lib/health/runtime-health";

export async function GET() {
  return createHealthResponse(await getReadinessReport());
}

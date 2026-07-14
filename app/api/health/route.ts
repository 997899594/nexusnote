import { createHealthResponse, getSystemHealthReport } from "@/lib/health/runtime-health";

export async function GET() {
  return createHealthResponse(await getSystemHealthReport());
}

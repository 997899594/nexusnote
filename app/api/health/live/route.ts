import { createHealthResponse, getLivenessReport } from "@/lib/health/runtime-health";

export function GET() {
  return createHealthResponse(getLivenessReport());
}

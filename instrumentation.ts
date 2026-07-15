export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNexusTelemetry } = await import("@/lib/observability/register");
    registerNexusTelemetry("nexusnote-web");
  }
}

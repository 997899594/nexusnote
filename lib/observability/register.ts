import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { registerOTel } from "@vercel/otel";

let registered = false;

function createMetricReader(): PeriodicExportingMetricReader | undefined {
  if (
    !process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT &&
    !process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  ) {
    return undefined;
  }

  return new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 30_000,
  });
}

export function registerNexusTelemetry(serviceName: string): void {
  if (registered || process.env.OTEL_SDK_DISABLED === "true") return;

  const metricReader = createMetricReader();
  registerOTel({
    serviceName,
    metricReaders: metricReader ? [metricReader] : [],
    attributes: {
      "service.namespace": "nexusnote",
      "deployment.environment.name": process.env.NODE_ENV ?? "development",
    },
  });
  registered = true;
}

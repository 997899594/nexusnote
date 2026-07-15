INSERT INTO app_schema_releases (version, metadata)
VALUES (
  '2026-07-15-runtime-control-planes-v3',
  '{"activationProjection":1,"analyticsOutboxLane":1,"queueRuntimePolicy":1,"aiCostMicroUsd":1,"openTelemetry":1,"migrationOwner":"atlas"}'::jsonb
)
ON CONFLICT (version) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  applied_at = now();

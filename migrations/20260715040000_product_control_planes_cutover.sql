INSERT INTO app_schema_releases (version, metadata)
VALUES (
  '2026-07-15-product-control-planes-v1',
  '{"activationFunnel":1,"outboxLifecycle":1,"aiCostGovernor":1,"migrationOwner":"atlas"}'::jsonb
)
ON CONFLICT (version) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  applied_at = now();

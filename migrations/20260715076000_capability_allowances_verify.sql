DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM product_access_grants
    WHERE email = '997899594@qq.com'
      AND plan = 'pro_year'
      AND revoked_at IS NULL
      AND expires_at IS NULL
      AND capabilities @> '["course_generation","research"]'::jsonb
  ) THEN
    RAISE EXCEPTION 'highest membership product access grant is missing';
  END IF;
END $$;

INSERT INTO app_schema_releases (version, metadata)
VALUES (
  '2026-07-15-runtime-control-planes-v5',
  '{"productAccessGrants":1,"capabilityUsageLedger":1,"freeResearchWeeklyLimit":3,"freeCourseLifetimeLimit":1,"migrationOwner":"atlas"}'::jsonb
)
ON CONFLICT (version) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  applied_at = now();

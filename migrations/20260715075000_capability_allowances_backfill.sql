INSERT INTO product_access_grants (
  email,
  plan,
  capabilities,
  source,
  metadata
)
VALUES (
  '997899594@qq.com',
  'pro_year',
  '["course_generation","research"]'::jsonb,
  'manual_product_grant',
  '{"membership":"highest","configuredAt":"2026-07-15"}'::jsonb
)
ON CONFLICT (email) DO UPDATE SET
  plan = EXCLUDED.plan,
  capabilities = EXCLUDED.capabilities,
  source = EXCLUDED.source,
  expires_at = NULL,
  revoked_at = NULL,
  metadata = product_access_grants.metadata || EXCLUDED.metadata,
  updated_at = now();

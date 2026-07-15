CREATE TABLE product_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  plan text NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  source text NOT NULL,
  starts_at timestamp NOT NULL DEFAULT now(),
  expires_at timestamp,
  revoked_at timestamp,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT product_access_grants_canonical_email_check
    CHECK (email = lower(btrim(email))),
  CONSTRAINT product_access_grants_capabilities_array_check
    CHECK (jsonb_typeof(capabilities) = 'array')
);

CREATE UNIQUE INDEX product_access_grants_email_unique_idx
  ON product_access_grants(email);
CREATE INDEX product_access_grants_active_idx
  ON product_access_grants(revoked_at, expires_at);

CREATE TABLE ai_capability_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability text NOT NULL,
  consumption_key text NOT NULL,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'consumed',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  refunded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_capability_usage_events_period_check CHECK (period_end > period_start),
  CONSTRAINT ai_capability_usage_events_status_check
    CHECK (status IN ('consumed', 'refunded')),
  CONSTRAINT ai_capability_usage_events_refund_check CHECK (
    (status = 'consumed' AND refunded_at IS NULL)
    OR (status = 'refunded' AND refunded_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX ai_capability_usage_events_key_unique_idx
  ON ai_capability_usage_events(consumption_key);
CREATE INDEX ai_capability_usage_events_allowance_idx
  ON ai_capability_usage_events(user_id, capability, period_start, status);

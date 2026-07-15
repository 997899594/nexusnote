ALTER TABLE ai_usage
  ADD COLUMN cost_micro_usd bigint NOT NULL DEFAULT 0,
  ADD COLUMN pricing_snapshot jsonb;

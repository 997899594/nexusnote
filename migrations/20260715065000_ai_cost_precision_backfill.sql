UPDATE ai_usage
SET
  cost_micro_usd = cost_cents::bigint * 10000,
  pricing_snapshot = jsonb_build_object(
    'version', 'legacy-cost-cents',
    'currency', 'USD',
    'model', model,
    'inputPerMillion', NULL,
    'outputPerMillion', NULL
  )
WHERE cost_cents <> 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM ai_usage
    WHERE cost_micro_usd < 0
      OR (cost_cents <> 0 AND cost_micro_usd <> cost_cents::bigint * 10000)
  ) THEN
    RAISE EXCEPTION 'ai_usage micro-USD backfill is inconsistent';
  END IF;
END $$;

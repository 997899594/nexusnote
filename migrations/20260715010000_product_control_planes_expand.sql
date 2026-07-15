ALTER TABLE domain_outbox_events
  ADD COLUMN IF NOT EXISTS dead_lettered_at timestamp,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamp,
  ADD COLUMN IF NOT EXISTS replay_count integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS domain_outbox_events_dispatch_idx
  ON domain_outbox_events(processed_at, dead_lettered_at, available_at);

CREATE INDEX IF NOT EXISTS learning_activity_events_type_occurred_at_idx
  ON learning_activity_events(event_type, occurred_at);

CREATE INDEX IF NOT EXISTS ai_usage_user_endpoint_created_at_idx
  ON ai_usage(user_id, endpoint, created_at);

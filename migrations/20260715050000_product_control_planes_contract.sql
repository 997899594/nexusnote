DROP INDEX IF EXISTS domain_outbox_events_pending_idx;

ALTER TABLE domain_outbox_events
  ALTER COLUMN replay_count SET NOT NULL,
  ALTER COLUMN replay_count SET DEFAULT 0;

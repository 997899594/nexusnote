ALTER TABLE conversations
  ADD COLUMN active_stream_id text;

ALTER TABLE conversation_messages
  ADD COLUMN message_id text;

ALTER TABLE career_generation_runs
  ADD COLUMN lease_token uuid,
  ADD COLUMN lease_expires_at timestamp,
  ADD COLUMN attempt_count integer NOT NULL DEFAULT 0;

CREATE TABLE runtime_worker_heartbeats (
  runtime_name text NOT NULL,
  worker_name text NOT NULL,
  instance_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT runtime_worker_heartbeats_pkey
    PRIMARY KEY (runtime_name, worker_name, instance_id)
);

CREATE INDEX runtime_heartbeats_freshness_idx
  ON runtime_worker_heartbeats(runtime_name, worker_name, last_seen_at);

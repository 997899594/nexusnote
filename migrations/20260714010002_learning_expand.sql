CREATE TABLE IF NOT EXISTS app_schema_releases (
  version text PRIMARY KEY,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  applied_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE course_outline_nodes ADD COLUMN IF NOT EXISTS semantic_id uuid;
ALTER TABLE course_outline_nodes ALTER COLUMN semantic_id SET DEFAULT gen_random_uuid();

ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS outline_version_id uuid;
ALTER TABLE course_sections ADD COLUMN IF NOT EXISTS outline_node_id uuid;

CREATE TABLE IF NOT EXISTS learning_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    CONSTRAINT learning_enrollments_user_id_users_id_fk
    REFERENCES users(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  course_id uuid NOT NULL
    CONSTRAINT learning_enrollments_course_id_courses_id_fk
    REFERENCES courses(id) ON DELETE CASCADE,
  outline_version_id uuid
    CONSTRAINT learning_enrollments_outline_version_id_course_outline_versions_id_fk
    REFERENCES course_outline_versions(id) ON DELETE CASCADE,
  publication_id uuid
    CONSTRAINT learning_enrollments_publication_id_course_publications_id_fk
    REFERENCES course_publications(id) ON DELETE CASCADE,
  snapshot_id uuid
    CONSTRAINT learning_enrollments_snapshot_id_course_publication_snapshots_id_fk
    REFERENCES course_publication_snapshots(id) ON DELETE CASCADE,
  started_at timestamp,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT learning_enrollments_source_shape_check CHECK (
    (
      source_type = 'course_revision'
      AND outline_version_id IS NOT NULL
      AND publication_id IS NULL
      AND snapshot_id IS NULL
    )
    OR
    (
      source_type = 'publication_snapshot'
      AND outline_version_id IS NULL
      AND publication_id IS NOT NULL
      AND snapshot_id IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS learning_enrollments_user_revision_unique_idx
  ON learning_enrollments(user_id, outline_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS learning_enrollments_user_snapshot_unique_idx
  ON learning_enrollments(user_id, snapshot_id);
CREATE INDEX IF NOT EXISTS learning_enrollments_user_updated_idx
  ON learning_enrollments(user_id, updated_at);
CREATE INDEX IF NOT EXISTS learning_enrollments_course_idx ON learning_enrollments(course_id);
CREATE INDEX IF NOT EXISTS learning_enrollments_publication_idx
  ON learning_enrollments(publication_id);

CREATE TABLE IF NOT EXISTS learning_section_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL
    CONSTRAINT learning_section_completions_enrollment_id_learning_enrollments_id_fk
    REFERENCES learning_enrollments(id) ON DELETE CASCADE,
  section_id uuid NOT NULL,
  completed_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS learning_section_completions_enrollment_section_unique_idx
  ON learning_section_completions(enrollment_id, section_id);
CREATE INDEX IF NOT EXISTS learning_section_completions_enrollment_completed_idx
  ON learning_section_completions(enrollment_id, completed_at);

CREATE TABLE IF NOT EXISTS domain_outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  available_at timestamp NOT NULL DEFAULT now(),
  processed_at timestamp,
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domain_outbox_events_pending_idx
  ON domain_outbox_events(processed_at, available_at);
CREATE INDEX IF NOT EXISTS domain_outbox_events_aggregate_idx
  ON domain_outbox_events(aggregate_type, aggregate_id);

CREATE TABLE IF NOT EXISTS runtime_heartbeats (
  runtime_name text PRIMARY KEY,
  instance_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
    CONSTRAINT learning_activity_events_user_id_users_id_fk
    REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL
    CONSTRAINT learning_activity_events_course_id_courses_id_fk
    REFERENCES courses(id) ON DELETE CASCADE,
  enrollment_id uuid
    CONSTRAINT learning_activity_events_enrollment_id_learning_enrollments_id_fk
    REFERENCES learning_enrollments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  section_node_id text,
  idempotency_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamp NOT NULL DEFAULT now(),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS learning_activity_events_idempotency_key_unique_idx
  ON learning_activity_events(idempotency_key);
CREATE INDEX IF NOT EXISTS learning_activity_events_user_occurred_at_idx
  ON learning_activity_events(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS learning_activity_events_course_occurred_at_idx
  ON learning_activity_events(course_id, occurred_at);
CREATE INDEX IF NOT EXISTS learning_activity_events_user_type_occurred_at_idx
  ON learning_activity_events(user_id, event_type, occurred_at);

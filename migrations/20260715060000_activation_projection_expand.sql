CREATE TABLE learning_activation_projections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  generated_at timestamp,
  started_at timestamp,
  first_completed_at timestamp,
  continued_at timestamp,
  completed_at timestamp,
  source_event_count integer NOT NULL DEFAULT 0,
  last_event_at timestamp NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX learning_activation_projections_user_course_unique_idx
  ON learning_activation_projections(user_id, course_id);

CREATE INDEX learning_activation_projections_user_generated_idx
  ON learning_activation_projections(user_id, generated_at);

CREATE INDEX learning_activation_projections_generated_idx
  ON learning_activation_projections(generated_at);

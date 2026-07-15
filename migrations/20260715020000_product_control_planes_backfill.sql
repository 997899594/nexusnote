INSERT INTO learning_activity_events (
  user_id,
  course_id,
  enrollment_id,
  event_type,
  idempotency_key,
  metadata,
  occurred_at,
  created_at
)
SELECT
  course.user_id,
  course.id,
  NULL,
  'course_generated',
  concat('course_generated:', course.user_id, ':', course.id),
  '{"source":"backfill"}'::jsonb,
  coalesce(course.created_at, now()),
  coalesce(course.created_at, now())
FROM courses AS course
WHERE EXISTS (
  SELECT 1
  FROM course_outline_versions AS version
  WHERE version.course_id = course.id
)
ON CONFLICT (idempotency_key) DO NOTHING;

UPDATE domain_outbox_events
SET replay_count = 0
WHERE replay_count IS NULL;

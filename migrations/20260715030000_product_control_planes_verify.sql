DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM courses AS course
    WHERE EXISTS (
      SELECT 1
      FROM course_outline_versions AS version
      WHERE version.course_id = course.id
    )
      AND NOT EXISTS (
        SELECT 1
        FROM learning_activity_events AS event
        WHERE event.course_id = course.id
          AND event.user_id = course.user_id
          AND event.event_type = 'course_generated'
      )
  ) THEN
    RAISE EXCEPTION 'course_generated learning event backfill is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM domain_outbox_events
    WHERE attempt_count < 0
      OR replay_count < 0
      OR (processed_at IS NOT NULL AND dead_lettered_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'domain_outbox_events contains an invalid lifecycle state';
  END IF;
END $$;

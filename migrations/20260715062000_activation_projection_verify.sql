DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT user_id, course_id, count(*)::integer AS event_count
      FROM learning_activity_events
      GROUP BY user_id, course_id
    ) AS source
    LEFT JOIN learning_activation_projections AS projection
      ON projection.user_id = source.user_id
      AND projection.course_id = source.course_id
    WHERE projection.id IS NULL
      OR projection.source_event_count <> source.event_count
  ) THEN
    RAISE EXCEPTION 'learning activation projection backfill is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM learning_activation_projections
    WHERE source_event_count <= 0
      OR last_event_at IS NULL
      OR (started_at IS NOT NULL AND generated_at IS NOT NULL AND started_at < generated_at)
      OR (first_completed_at IS NOT NULL AND started_at IS NOT NULL
        AND first_completed_at < started_at)
      OR (continued_at IS NOT NULL AND started_at IS NULL)
      OR (continued_at IS NOT NULL AND continued_at < started_at + interval '7 days')
  ) THEN
    RAISE EXCEPTION 'learning activation projection contains an invalid milestone state';
  END IF;
END $$;

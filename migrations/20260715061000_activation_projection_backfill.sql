INSERT INTO learning_activation_projections (
  user_id,
  course_id,
  generated_at,
  started_at,
  first_completed_at,
  continued_at,
  completed_at,
  source_event_count,
  last_event_at,
  updated_at
)
WITH milestone_base AS (
  SELECT
    user_id,
    course_id,
    min(occurred_at) FILTER (WHERE event_type = 'course_generated') AS generated_at,
    min(occurred_at) FILTER (WHERE event_type = 'course_started') AS started_at,
    min(occurred_at) FILTER (WHERE event_type = 'section_completed') AS first_completed_at,
    min(occurred_at) FILTER (WHERE event_type = 'course_completed') AS completed_at,
    count(*)::integer AS source_event_count,
    max(occurred_at) AS last_event_at
  FROM learning_activity_events
  GROUP BY user_id, course_id
)
SELECT
  milestone.user_id,
  milestone.course_id,
  milestone.generated_at,
  milestone.started_at,
  milestone.first_completed_at,
  min(event.occurred_at) FILTER (
    WHERE event.event_type IN ('course_opened', 'section_completed')
      AND milestone.started_at IS NOT NULL
      AND event.occurred_at >= milestone.started_at + interval '7 days'
  ),
  milestone.completed_at,
  milestone.source_event_count,
  milestone.last_event_at,
  now()
FROM milestone_base AS milestone
JOIN learning_activity_events AS event
  ON event.user_id = milestone.user_id
  AND event.course_id = milestone.course_id
GROUP BY
  milestone.user_id,
  milestone.course_id,
  milestone.generated_at,
  milestone.started_at,
  milestone.first_completed_at,
  milestone.completed_at,
  milestone.source_event_count,
  milestone.last_event_at
ON CONFLICT (user_id, course_id) DO UPDATE SET
  generated_at = EXCLUDED.generated_at,
  started_at = EXCLUDED.started_at,
  first_completed_at = EXCLUDED.first_completed_at,
  continued_at = EXCLUDED.continued_at,
  completed_at = EXCLUDED.completed_at,
  source_event_count = EXCLUDED.source_event_count,
  last_event_at = EXCLUDED.last_event_at,
  updated_at = now();

UPDATE course_outline_nodes
SET semantic_id = gen_random_uuid()
WHERE semantic_id IS NULL;

UPDATE course_sections AS section
SET
  outline_version_id = version.id,
  outline_node_id = node.id
FROM course_outline_versions AS version
JOIN course_outline_nodes AS node ON node.outline_version_id = version.id
WHERE version.course_id = section.course_id
  AND version.is_latest = true
  AND node.node_key = section.outline_node_key
  AND (section.outline_version_id IS NULL OR section.outline_node_id IS NULL);

DO $$
BEGIN
  IF to_regclass('course_progress') IS NOT NULL THEN
    INSERT INTO learning_enrollments (
      user_id,
      source_type,
      course_id,
      outline_version_id,
      started_at,
      completed_at,
      created_at,
      updated_at
    )
    SELECT
      progress.user_id,
      'course_revision',
      progress.course_id,
      version.id,
      progress.started_at,
      progress.completed_at,
      coalesce(progress.created_at, now()),
      coalesce(progress.updated_at, progress.created_at, now())
    FROM course_progress AS progress
    JOIN course_outline_versions AS version
      ON version.course_id = progress.course_id AND version.is_latest = true
    ON CONFLICT (user_id, outline_version_id) DO UPDATE SET
      started_at = EXCLUDED.started_at,
      completed_at = EXCLUDED.completed_at,
      updated_at = EXCLUDED.updated_at;

    INSERT INTO learning_section_completions (enrollment_id, section_id, completed_at)
    SELECT
      enrollment.id,
      node.semantic_id,
      coalesce(progress.updated_at, progress.started_at, progress.created_at, now())
    FROM course_progress AS progress
    JOIN learning_enrollments AS enrollment
      ON enrollment.user_id = progress.user_id
      AND enrollment.course_id = progress.course_id
      AND enrollment.source_type = 'course_revision'
    JOIN course_outline_nodes AS node
      ON node.outline_version_id = enrollment.outline_version_id
    CROSS JOIN LATERAL jsonb_array_elements_text(progress.completed_sections) AS completed(node_key)
    WHERE node.node_type = 'section' AND node.node_key = completed.node_key
    ON CONFLICT (enrollment_id, section_id) DO NOTHING;
  END IF;

  IF to_regclass('course_publication_progress') IS NOT NULL THEN
    INSERT INTO learning_enrollments (
      user_id,
      source_type,
      course_id,
      publication_id,
      snapshot_id,
      started_at,
      completed_at,
      created_at,
      updated_at
    )
    SELECT
      progress.user_id,
      'publication_snapshot',
      publication.source_course_id,
      publication.id,
      publication.current_snapshot_id,
      progress.started_at,
      progress.completed_at,
      progress.created_at,
      progress.updated_at
    FROM course_publication_progress AS progress
    JOIN course_publications AS publication ON publication.id = progress.publication_id
    WHERE publication.current_snapshot_id IS NOT NULL
    ON CONFLICT (user_id, snapshot_id) DO UPDATE SET
      started_at = EXCLUDED.started_at,
      completed_at = EXCLUDED.completed_at,
      updated_at = EXCLUDED.updated_at;

    INSERT INTO learning_section_completions (enrollment_id, section_id, completed_at)
    SELECT
      enrollment.id,
      node.semantic_id,
      coalesce(progress.updated_at, progress.started_at, progress.created_at, now())
    FROM course_publication_progress AS progress
    JOIN course_publications AS publication ON publication.id = progress.publication_id
    JOIN learning_enrollments AS enrollment
      ON enrollment.user_id = progress.user_id
      AND enrollment.snapshot_id = publication.current_snapshot_id
    JOIN course_publication_snapshots AS snapshot ON snapshot.id = enrollment.snapshot_id
    JOIN course_outline_nodes AS node
      ON node.outline_version_id = snapshot.source_outline_version_id
    CROSS JOIN LATERAL jsonb_array_elements_text(progress.completed_sections) AS completed(node_key)
    WHERE node.node_type = 'section' AND node.node_key = completed.node_key
    ON CONFLICT (enrollment_id, section_id) DO NOTHING;
  END IF;
END $$;

UPDATE learning_activity_events AS event
SET enrollment_id = enrollment.id
FROM learning_enrollments AS enrollment
WHERE event.enrollment_id IS NULL
  AND enrollment.user_id = event.user_id
  AND enrollment.course_id = event.course_id
  AND enrollment.source_type = 'course_revision';

UPDATE learning_activity_events AS event
SET section_node_id = node.semantic_id::text
FROM learning_enrollments AS enrollment
JOIN course_outline_nodes AS node ON node.outline_version_id = enrollment.outline_version_id
WHERE event.enrollment_id = enrollment.id
  AND event.section_node_id = node.node_key
  AND node.node_type = 'section';

UPDATE learning_activity_events
SET idempotency_key = CASE
  WHEN event_type = 'section_completed'
    THEN concat(event_type, ':', user_id, ':', enrollment_id, ':', section_node_id)
  WHEN event_type = 'course_opened'
    THEN concat(event_type, ':', user_id, ':', enrollment_id, ':', id)
  ELSE concat(event_type, ':', user_id, ':', enrollment_id)
END
WHERE enrollment_id IS NOT NULL;

WITH section_duration AS (
  SELECT
    version.course_id,
    count(section.id) AS section_count,
    bool_and(coalesce(btrim(section.plain_text), '') <> '') AS all_readable,
    sum(
      greatest(
        1,
        ceil(
          length(regexp_replace(coalesce(section.plain_text, ''), '[^一-龥]', '', 'g')) / 400.0
          + CASE
              WHEN btrim(regexp_replace(coalesce(section.plain_text, ''), '[^A-Za-z0-9]+', ' ', 'g')) = ''
                THEN 0
              ELSE cardinality(
                regexp_split_to_array(
                  btrim(regexp_replace(section.plain_text, '[^A-Za-z0-9]+', ' ', 'g')),
                  '\s+'
                )
              )
            END / 220.0
        )
      )
    )::integer AS estimated_minutes
  FROM course_outline_versions AS version
  LEFT JOIN course_sections AS section ON section.outline_version_id = version.id
  WHERE version.is_latest = true
  GROUP BY version.course_id
)
UPDATE courses AS course
SET estimated_minutes = CASE
  WHEN duration.section_count > 0 AND duration.all_readable THEN duration.estimated_minutes
  ELSE NULL
END
FROM section_duration AS duration
WHERE duration.course_id = course.id;

DO $$
DECLARE
  snapshot_record record;
  content jsonb;
  chapters jsonb;
  sections jsonb;
BEGIN
  FOR snapshot_record IN
    SELECT
      snapshot.id,
      snapshot.source_outline_version_id,
      snapshot.content_json,
      course.estimated_minutes
    FROM course_publication_snapshots AS snapshot
    JOIN courses AS course ON course.id = snapshot.source_course_id
  LOOP
    content := jsonb_set(
      snapshot_record.content_json,
      '{course,estimatedMinutes}',
      coalesce(to_jsonb(snapshot_record.estimated_minutes), 'null'::jsonb),
      true
    );

    SELECT coalesce(jsonb_agg(rewritten.chapter ORDER BY rewritten.chapter_number), '[]'::jsonb)
    INTO chapters
    FROM (
      SELECT
        chapter_number,
        chapter
          || jsonb_build_object(
            'nodeId',
            coalesce(
              (
                SELECT node.semantic_id::text
                FROM course_outline_nodes AS node
                WHERE node.outline_version_id = snapshot_record.source_outline_version_id
                  AND node.node_key = concat('chapter-', chapter_number)
              ),
              chapter->>'nodeId'
            ),
            'sections',
            (
              SELECT coalesce(
                jsonb_agg(
                  section
                    || jsonb_build_object(
                      'nodeId',
                      coalesce(
                        (
                          SELECT node.semantic_id::text
                          FROM course_outline_nodes AS node
                          WHERE node.outline_version_id = snapshot_record.source_outline_version_id
                            AND node.node_key = concat(
                              'section-',
                              chapter_number,
                              '-',
                              section_number
                            )
                        ),
                        section->>'nodeId'
                      )
                    )
                  ORDER BY section_number
                ),
                '[]'::jsonb
              )
              FROM jsonb_array_elements(chapter->'sections')
                WITH ORDINALITY AS section_rows(section, section_number)
            )
          ) AS chapter
      FROM jsonb_array_elements(content#>'{outline,chapters}')
        WITH ORDINALITY AS chapter_rows(chapter, chapter_number)
    ) AS rewritten;

    SELECT coalesce(
      jsonb_agg(
        section
          || jsonb_build_object(
            'nodeId',
            coalesce(
              (
                SELECT node.semantic_id::text
                FROM course_outline_nodes AS node
                WHERE node.outline_version_id = snapshot_record.source_outline_version_id
                  AND node.node_key = section->>'nodeId'
              ),
              section->>'nodeId'
            )
          )
        ORDER BY section_number
      ),
      '[]'::jsonb
    )
    INTO sections
    FROM jsonb_array_elements(content->'sections')
      WITH ORDINALITY AS section_rows(section, section_number);

    content := jsonb_set(content, '{outline,chapters}', chapters, true);
    content := jsonb_set(content, '{sections}', sections, true);

    UPDATE course_publication_snapshots
    SET content_json = content
    WHERE id = snapshot_record.id;
  END LOOP;
END $$;

UPDATE course_public_annotations AS annotation
SET section_key = node.semantic_id::text
FROM course_publication_snapshots AS snapshot
JOIN course_outline_nodes AS node
  ON node.outline_version_id = snapshot.source_outline_version_id
WHERE annotation.snapshot_id = snapshot.id
  AND annotation.section_key = node.node_key
  AND node.node_type = 'section';

DELETE FROM learning_section_completions AS completion
USING learning_enrollments AS enrollment
WHERE completion.enrollment_id = enrollment.id
  AND (
    (
      enrollment.source_type = 'course_revision'
      AND NOT EXISTS (
        SELECT 1
        FROM course_sections AS section
        JOIN course_outline_nodes AS node ON node.id = section.outline_node_id
        WHERE section.outline_version_id = enrollment.outline_version_id
          AND section.content_markdown IS NOT NULL
          AND node.semantic_id = completion.section_id
      )
    )
    OR
    (
      enrollment.source_type = 'publication_snapshot'
      AND NOT EXISTS (
        SELECT 1
        FROM course_publication_snapshots AS snapshot
        CROSS JOIN LATERAL jsonb_array_elements(snapshot.content_json->'sections') AS item(section)
        WHERE snapshot.id = enrollment.snapshot_id
          AND item.section->>'nodeId' = completion.section_id::text
          AND nullif(item.section->>'content', '') IS NOT NULL
      )
    )
  );

WITH enrollment_counts AS (
  SELECT
    enrollment.id,
    CASE
      WHEN enrollment.source_type = 'course_revision' THEN (
        SELECT count(*)
        FROM course_outline_nodes AS node
        WHERE node.outline_version_id = enrollment.outline_version_id
          AND node.node_type = 'section'
      )
      ELSE (
        SELECT coalesce(jsonb_array_length(snapshot.content_json->'sections'), 0)
        FROM course_publication_snapshots AS snapshot
        WHERE snapshot.id = enrollment.snapshot_id
      )
    END AS total_count,
    (
      SELECT count(*)
      FROM learning_section_completions AS completion
      WHERE completion.enrollment_id = enrollment.id
    ) AS completed_count
  FROM learning_enrollments AS enrollment
)
UPDATE learning_enrollments AS enrollment
SET completed_at = CASE
  WHEN counts.total_count > 0 AND counts.completed_count = counts.total_count
    THEN coalesce(enrollment.completed_at, enrollment.updated_at)
  ELSE NULL
END
FROM enrollment_counts AS counts
WHERE counts.id = enrollment.id;

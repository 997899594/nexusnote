DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM course_outline_nodes WHERE semantic_id IS NULL) THEN
    RAISE EXCEPTION 'course_outline_nodes semantic_id backfill is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM course_sections
    WHERE outline_version_id IS NULL OR outline_node_id IS NULL
  ) THEN
    RAISE EXCEPTION 'course_sections outline revision mapping is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM learning_section_completions AS completion
    LEFT JOIN learning_enrollments AS enrollment ON enrollment.id = completion.enrollment_id
    WHERE enrollment.id IS NULL
  ) THEN
    RAISE EXCEPTION 'learning_section_completions contains orphaned rows';
  END IF;

  IF (
    SELECT format_type(attribute.atttypid, attribute.atttypmod) <> 'vector(1536)'
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'knowledge_evidence_chunks'::regclass
      AND attribute.attname = 'embedding'
      AND NOT attribute.attisdropped
  ) THEN
    RAISE EXCEPTION 'knowledge_evidence_chunks.embedding is not vector(1536)';
  END IF;

  IF (
    SELECT format_type(attribute.atttypid, attribute.atttypmod) <> 'vector(1536)'
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'tags'::regclass
      AND attribute.attname = 'name_embedding'
      AND NOT attribute.attisdropped
  ) THEN
    RAISE EXCEPTION 'tags.name_embedding is not vector(1536)';
  END IF;
END $$;

ALTER TABLE course_outline_nodes ALTER COLUMN semantic_id SET NOT NULL;
ALTER TABLE course_sections ALTER COLUMN outline_version_id SET NOT NULL;
ALTER TABLE course_sections ALTER COLUMN outline_node_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS course_outline_nodes_outline_semantic_unique_idx
  ON course_outline_nodes(outline_version_id, semantic_id);

DO $$
BEGIN
  ALTER TABLE learning_enrollments
    DROP CONSTRAINT IF EXISTS learning_enrollments_user_id_fkey,
    DROP CONSTRAINT IF EXISTS learning_enrollments_course_id_fkey,
    DROP CONSTRAINT IF EXISTS learning_enrollments_outline_version_id_fkey,
    DROP CONSTRAINT IF EXISTS learning_enrollments_publication_id_fkey,
    DROP CONSTRAINT IF EXISTS learning_enrollments_snapshot_id_fkey;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_enrollments_user_id_users_id_fk'
  ) THEN
    ALTER TABLE learning_enrollments
      ADD CONSTRAINT learning_enrollments_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_enrollments_course_id_courses_id_fk'
  ) THEN
    ALTER TABLE learning_enrollments
      ADD CONSTRAINT learning_enrollments_course_id_courses_id_fk
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_enrollments_outline_version_id_course_outline_versions_id_fk'
  ) THEN
    ALTER TABLE learning_enrollments
      ADD CONSTRAINT learning_enrollments_outline_version_id_course_outline_versions_id_fk
      FOREIGN KEY (outline_version_id) REFERENCES course_outline_versions(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_enrollments_publication_id_course_publications_id_fk'
  ) THEN
    ALTER TABLE learning_enrollments
      ADD CONSTRAINT learning_enrollments_publication_id_course_publications_id_fk
      FOREIGN KEY (publication_id) REFERENCES course_publications(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_enrollments_snapshot_id_course_publication_snapshots_id_fk'
  ) THEN
    ALTER TABLE learning_enrollments
      ADD CONSTRAINT learning_enrollments_snapshot_id_course_publication_snapshots_id_fk
      FOREIGN KEY (snapshot_id) REFERENCES course_publication_snapshots(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_enrollments_source_shape_check'
  ) THEN
    ALTER TABLE learning_enrollments
      ADD CONSTRAINT learning_enrollments_source_shape_check CHECK (
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
      );
  END IF;

  ALTER TABLE learning_section_completions
    DROP CONSTRAINT IF EXISTS learning_section_completions_enrollment_id_fkey;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_section_completions_enrollment_id_learning_enrollments_id_fk'
  ) THEN
    ALTER TABLE learning_section_completions
      ADD CONSTRAINT learning_section_completions_enrollment_id_learning_enrollments_id_fk
      FOREIGN KEY (enrollment_id) REFERENCES learning_enrollments(id) ON DELETE CASCADE;
  END IF;

  ALTER TABLE learning_activity_events
    DROP CONSTRAINT IF EXISTS learning_activity_events_user_id_fkey,
    DROP CONSTRAINT IF EXISTS learning_activity_events_course_id_fkey,
    DROP CONSTRAINT IF EXISTS learning_activity_events_enrollment_id_fkey;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_activity_events_user_id_users_id_fk'
  ) THEN
    ALTER TABLE learning_activity_events
      ADD CONSTRAINT learning_activity_events_user_id_users_id_fk
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_activity_events_course_id_courses_id_fk'
  ) THEN
    ALTER TABLE learning_activity_events
      ADD CONSTRAINT learning_activity_events_course_id_courses_id_fk
      FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'learning_activity_events_enrollment_id_learning_enrollments_id_fk'
  ) THEN
    ALTER TABLE learning_activity_events
      ADD CONSTRAINT learning_activity_events_enrollment_id_learning_enrollments_id_fk
      FOREIGN KEY (enrollment_id) REFERENCES learning_enrollments(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_sections_outline_version_id_course_outline_versions_id_fk'
  ) THEN
    ALTER TABLE course_sections
      ADD CONSTRAINT course_sections_outline_version_id_course_outline_versions_id_fk
      FOREIGN KEY (outline_version_id) REFERENCES course_outline_versions(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'course_sections_outline_node_id_course_outline_nodes_id_fk'
  ) THEN
    ALTER TABLE course_sections
      ADD CONSTRAINT course_sections_outline_node_id_course_outline_nodes_id_fk
      FOREIGN KEY (outline_node_id) REFERENCES course_outline_nodes(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS course_sections_course_outline_idx;
CREATE UNIQUE INDEX IF NOT EXISTS course_sections_outline_node_unique_idx
  ON course_sections(outline_node_id);
CREATE UNIQUE INDEX IF NOT EXISTS course_sections_version_node_key_unique_idx
  ON course_sections(outline_version_id, outline_node_key);

INSERT INTO app_schema_releases (version, metadata)
VALUES (
  '2026-07-14-learning-model-v2',
  '{"learningModel":2,"outbox":true,"migrationOwner":"atlas"}'::jsonb
)
ON CONFLICT (version) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  applied_at = now();

ALTER TABLE conversation_messages
  ALTER COLUMN message_id SET NOT NULL;

CREATE UNIQUE INDEX conversation_messages_conversation_message_idx
  ON conversation_messages(conversation_id, message_id);

DROP INDEX course_outline_versions_course_latest_idx;
CREATE UNIQUE INDEX course_outline_versions_course_latest_idx
  ON course_outline_versions(course_id)
  WHERE is_latest = true;

DROP INDEX career_user_tree_snapshots_user_latest_idx;
CREATE UNIQUE INDEX career_user_tree_snapshots_user_latest_idx
  ON career_user_tree_snapshots(user_id)
  WHERE is_latest = true;

INSERT INTO app_schema_releases (version, metadata)
VALUES (
  '2026-07-15-runtime-control-planes-v4',
  '{"conversationAppendModel":1,"careerRunFencing":1,"workerHeartbeatIdentity":2,"latestRowInvariants":1,"migrationOwner":"atlas"}'::jsonb
)
ON CONFLICT (version) DO UPDATE SET
  metadata = EXCLUDED.metadata,
  applied_at = now();

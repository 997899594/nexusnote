UPDATE conversations
SET active_stream_id = metadata->>'activeStreamId'
WHERE active_stream_id IS NULL
  AND nullif(metadata->>'activeStreamId', '') IS NOT NULL;

UPDATE conversation_messages
SET message_id = coalesce(nullif(message->>'id', ''), id::text)
WHERE message_id IS NULL;

WITH duplicate_messages AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY conversation_id, message_id
      ORDER BY position, created_at, id
    ) AS duplicate_rank
  FROM conversation_messages
)
UPDATE conversation_messages AS message
SET message_id = message.id::text
FROM duplicate_messages AS duplicate
WHERE message.id = duplicate.id
  AND duplicate.duplicate_rank > 1;

WITH ranked_outlines AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY course_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS latest_rank
  FROM course_outline_versions
  WHERE is_latest = true
)
UPDATE course_outline_versions AS outline
SET is_latest = false
FROM ranked_outlines AS ranked
WHERE outline.id = ranked.id
  AND ranked.latest_rank > 1;

WITH ranked_snapshots AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY user_id
      ORDER BY generated_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS latest_rank
  FROM career_user_tree_snapshots
  WHERE is_latest = true
)
UPDATE career_user_tree_snapshots AS snapshot
SET is_latest = false
FROM ranked_snapshots AS ranked
WHERE snapshot.id = ranked.id
  AND ranked.latest_rank > 1;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM conversation_messages WHERE message_id IS NULL) THEN
    RAISE EXCEPTION 'conversation_messages.message_id backfill is incomplete';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM conversation_messages
    GROUP BY conversation_id, message_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'conversation message identities are not unique';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM course_outline_versions
    WHERE is_latest = true
    GROUP BY course_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'multiple latest course outlines remain';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM career_user_tree_snapshots
    WHERE is_latest = true
    GROUP BY user_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'multiple latest career snapshots remain';
  END IF;
END $$;

DO $$
BEGIN
  IF (
    SELECT format_type(attribute.atttypid, attribute.atttypmod) <> 'vector(1536)'
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'knowledge_evidence_chunks'::regclass
      AND attribute.attname = 'embedding'
      AND NOT attribute.attisdropped
  ) THEN
    ALTER TABLE knowledge_evidence_chunks
      ALTER COLUMN embedding TYPE vector(1536)
      USING subvector(embedding, 1, 1536)::vector(1536);
  END IF;

  IF (
    SELECT format_type(attribute.atttypid, attribute.atttypmod) <> 'vector(1536)'
    FROM pg_attribute AS attribute
    WHERE attribute.attrelid = 'tags'::regclass
      AND attribute.attname = 'name_embedding'
      AND NOT attribute.attisdropped
  ) THEN
    ALTER TABLE tags
      ALTER COLUMN name_embedding TYPE vector(1536)
      USING subvector(name_embedding, 1, 1536)::vector(1536);
  END IF;
END $$;

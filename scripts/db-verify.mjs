import postgres from "postgres";

const REQUIRED_EXTENSIONS = ["vector"];

const REQUIRED_TABLES = [
  "accounts",
  "ai_skins",
  "ai_usage",
  "conversation_messages",
  "conversations",
  "course_chapter_skill_mappings",
  "course_progress",
  "course_section_annotations",
  "course_sections",
  "course_skill_mappings",
  "courses",
  "knowledge_chunks",
  "note_snapshots",
  "note_tags",
  "notes",
  "sessions",
  "skill_relationships",
  "skills",
  "style_privacy_settings",
  "tags",
  "user_profiles",
  "user_skill_mastery",
  "user_skin_preferences",
  "users",
  "verification_tokens",
];

const FORBIDDEN_TABLES = [
  "course_sessions",
  "document_snapshots",
  "document_tags",
  "documents",
  "extracted_notes",
  "persona_subscriptions",
  "personas",
  "topics",
  "user_persona_preferences",
  "workspaces",
];

const REQUIRED_COLUMNS = [
  ["ai_usage", "metadata"],
  ["ai_usage", "model_policy"],
  ["ai_usage", "profile"],
  ["ai_usage", "prompt_version"],
  ["ai_usage", "provider"],
  ["ai_usage", "request_id"],
  ["ai_usage", "workflow"],
  ["conversation_messages", "conversation_id"],
  ["conversation_messages", "message"],
  ["conversation_messages", "position"],
  ["conversation_messages", "role"],
  ["conversation_messages", "text_content"],
  ["conversations", "metadata"],
  ["knowledge_chunks", "embedding"],
  ["notes", "content_html"],
  ["notes", "source_context"],
  ["notes", "source_type"],
  ["tags", "name_embedding"],
  ["user_profiles", "ai_preferences"],
  ["user_skin_preferences", "default_skin_slug"],
];

const FORBIDDEN_COLUMNS = [["conversations", "messages"]];

const REQUIRED_INDEXES = [
  "conversation_messages_conversation_idx",
  "conversation_messages_conversation_position_idx",
  "conversations_user_updated_at_idx",
  "courses_user_updated_at_idx",
  "knowledge_chunks_content_fts_idx",
  "knowledge_chunks_embedding_hnsw_idx",
  "notes_source_type_idx",
  "notes_user_updated_at_idx",
  "tags_name_embedding_hnsw_idx",
];

function getConnectionString(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return connectionString;
}

function toColumnKey(tableName, columnName) {
  return `${tableName}.${columnName}`;
}

export async function ensurePgvector(connectionString = process.env.DATABASE_URL) {
  const sql = postgres(getConnectionString(connectionString), {
    max: 1,
    prepare: false,
  });

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector;`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export async function verifyCurrentSchema(connectionString = process.env.DATABASE_URL) {
  const sql = postgres(getConnectionString(connectionString), {
    max: 1,
    prepare: false,
  });

  try {
    const [extensionRows, tableRows, columnRows, indexRows] = await Promise.all([
      sql`
        SELECT extname
        FROM pg_extension
      `,
      sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
      `,
      sql`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
      `,
      sql`
        SELECT indexname
        FROM pg_indexes
        WHERE schemaname = 'public'
      `,
    ]);

    const extensions = new Set(extensionRows.map((row) => row.extname));
    const tables = new Set(tableRows.map((row) => row.table_name));
    const columns = new Set(columnRows.map((row) => toColumnKey(row.table_name, row.column_name)));
    const indexes = new Set(indexRows.map((row) => row.indexname));

    const failures = [];

    for (const extension of REQUIRED_EXTENSIONS) {
      if (!extensions.has(extension)) {
        failures.push(`missing extension ${extension}`);
      }
    }

    for (const tableName of REQUIRED_TABLES) {
      if (!tables.has(tableName)) {
        failures.push(`missing table ${tableName}`);
      }
    }

    for (const tableName of FORBIDDEN_TABLES) {
      if (tables.has(tableName)) {
        failures.push(`unexpected legacy table ${tableName}`);
      }
    }

    for (const [tableName, columnName] of REQUIRED_COLUMNS) {
      if (!columns.has(toColumnKey(tableName, columnName))) {
        failures.push(`missing column ${tableName}.${columnName}`);
      }
    }

    for (const [tableName, columnName] of FORBIDDEN_COLUMNS) {
      if (columns.has(toColumnKey(tableName, columnName))) {
        failures.push(`unexpected legacy column ${tableName}.${columnName}`);
      }
    }

    for (const indexName of REQUIRED_INDEXES) {
      if (!indexes.has(indexName)) {
        failures.push(`missing index ${indexName}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Schema verification failed:\n- ${failures.join("\n- ")}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

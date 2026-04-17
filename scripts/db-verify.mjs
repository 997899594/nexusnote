import postgres from "postgres";

const REQUIRED_EXTENSIONS = ["vector"];

const REQUIRED_TABLES = [
  "accounts",
  "ai_skins",
  "ai_usage",
  "knowledge_generation_runs",
  "user_growth_state",
  "user_skill_edges",
  "user_skill_node_evidence",
  "user_skill_nodes",
  "user_career_tree_preferences",
  "user_career_tree_snapshots",
  "conversation_messages",
  "conversations",
  "course_outline_nodes",
  "course_outline_versions",
  "course_progress",
  "course_section_annotations",
  "course_sections",
  "courses",
  "knowledge_evidence_chunks",
  "knowledge_evidence",
  "knowledge_evidence_event_refs",
  "knowledge_evidence_events",
  "knowledge_evidence_source_links",
  "knowledge_insight_evidence",
  "knowledge_insights",
  "note_snapshots",
  "note_tags",
  "notes",
  "sessions",
  "style_privacy_settings",
  "tags",
  "user_profiles",
  "user_focus_snapshots",
  "user_profile_snapshots",
  "user_skin_preferences",
  "users",
  "verification_tokens",
];

const FORBIDDEN_TABLES = [
  "career_generation_runs",
  "career_user_graph_state",
  "career_user_skill_edges",
  "career_user_skill_node_evidence",
  "career_user_skill_nodes",
  "career_user_tree_preferences",
  "career_user_tree_snapshots",
  "course_sessions",
  "course_chapter_skill_mappings",
  "course_skill_mappings",
  "document_snapshots",
  "document_tags",
  "documents",
  "extracted_notes",
  "knowledge_chunks",
  "persona_subscriptions",
  "personas",
  "skill_relationships",
  "skills",
  "topics",
  "user_persona_preferences",
  "user_skill_mastery",
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
  ["conversations", "learn_chapter_index"],
  ["conversations", "learn_course_id"],
  ["conversations", "metadata"],
  ["course_sections", "outline_node_key"],
  ["knowledge_evidence_chunks", "knowledge_evidence_id"],
  ["knowledge_evidence_chunks", "embedding"],
  ["notes", "content_html"],
  ["notes", "source_context"],
  ["notes", "source_type"],
  ["tags", "name_embedding"],
  ["user_profiles", "ai_preferences"],
  ["user_skin_preferences", "default_skin_slug"],
];

const FORBIDDEN_COLUMNS = [
  ["conversations", "messages"],
  ["courses", "outline_data"],
  ["knowledge_evidence_chunks", "source_id"],
  ["knowledge_evidence_chunks", "source_type"],
  ["knowledge_evidence_chunks", "user_id"],
];

function getConnectionString(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  return connectionString;
}

function getDatabaseName(connectionString = process.env.DATABASE_URL) {
  const url = new URL(getConnectionString(connectionString));
  const databaseName = url.pathname.replace(/^\/+/, "");

  if (!databaseName) {
    throw new Error("DATABASE_URL must include a database name");
  }

  return databaseName;
}

function sanitizeIdentifier(identifier) {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsupported database identifier: ${identifier}`);
  }

  return identifier;
}

function buildAdminConnectionString(connectionString = process.env.DATABASE_URL) {
  const url = new URL(getConnectionString(connectionString));
  url.pathname = "/postgres";
  return url.toString();
}

export function buildAtlasDevConnectionString(connectionString = process.env.DATABASE_URL) {
  const url = new URL(getConnectionString(connectionString));
  const databaseName = sanitizeIdentifier(getDatabaseName(connectionString));
  url.pathname = `/${databaseName}_atlas_dev`;
  return url.toString();
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

export async function ensureAtlasDevDatabase(connectionString = process.env.DATABASE_URL) {
  const devConnectionString = buildAtlasDevConnectionString(connectionString);
  const devDatabaseName = sanitizeIdentifier(getDatabaseName(devConnectionString));
  const adminSql = postgres(buildAdminConnectionString(connectionString), {
    max: 1,
    prepare: false,
  });

  try {
    const rows =
      await adminSql`SELECT 1 FROM pg_database WHERE datname = ${devDatabaseName} LIMIT 1;`;

    if (rows.length === 0) {
      await adminSql.unsafe(`CREATE DATABASE "${devDatabaseName}"`);
    }
  } finally {
    await adminSql.end({ timeout: 5 });
  }

  await ensurePgvector(devConnectionString);
  return devConnectionString;
}

export async function verifyCurrentSchema(connectionString = process.env.DATABASE_URL) {
  const sql = postgres(getConnectionString(connectionString), {
    max: 1,
    prepare: false,
  });

  try {
    const [extensionRows, tableRows, columnRows] = await Promise.all([
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
    ]);

    const extensions = new Set(extensionRows.map((row) => row.extname));
    const tables = new Set(tableRows.map((row) => row.table_name));
    const columns = new Set(columnRows.map((row) => toColumnKey(row.table_name, row.column_name)));
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

    if (failures.length > 0) {
      throw new Error(`Schema verification failed:\n- ${failures.join("\n- ")}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

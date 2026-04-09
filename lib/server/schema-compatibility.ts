import "server-only";
import { db, sql } from "@/db";

const REQUIRED_SCHEMA_COLUMNS = [
  ["conversations", "learn_course_id"],
  ["conversations", "learn_chapter_index"],
] as const;

function toColumnKey(tableName: string, columnName: string): string {
  return `${tableName}.${columnName}`;
}

export interface SchemaCompatibilityResult {
  isCompatible: boolean;
  missingColumns: string[];
  summary: string | null;
}

export async function getSchemaCompatibilityResult(): Promise<SchemaCompatibilityResult> {
  const rows = await db.execute<{
    table_name: string;
    column_name: string;
  }>(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
        (table_name = 'conversations' AND column_name = 'learn_course_id')
        OR
        (table_name = 'conversations' AND column_name = 'learn_chapter_index')
      )
  `);

  const existingColumns = new Set(rows.map((row) => toColumnKey(row.table_name, row.column_name)));
  const missingColumns = REQUIRED_SCHEMA_COLUMNS.filter(
    ([tableName, columnName]) => !existingColumns.has(toColumnKey(tableName, columnName)),
  ).map(([tableName, columnName]) => toColumnKey(tableName, columnName));

  return {
    isCompatible: missingColumns.length === 0,
    missingColumns,
    summary:
      missingColumns.length === 0
        ? null
        : `Missing required schema columns: ${missingColumns.join(", ")}`,
  };
}

export async function assertSchemaCompatibility(): Promise<void> {
  const result = await getSchemaCompatibilityResult();

  if (!result.isCompatible) {
    throw new Error(result.summary ?? "Schema compatibility check failed");
  }
}

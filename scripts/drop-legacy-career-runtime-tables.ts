import "dotenv/config";
import postgres from "postgres";

const LEGACY_CAREER_RUNTIME_TABLES = [
  "user_profile_snapshots",
  "user_focus_snapshots",
  "user_career_tree_snapshots",
  "user_career_tree_preferences",
  "user_skill_node_evidence",
  "user_skill_edges",
  "user_skill_nodes",
  "user_growth_state",
] as const;

interface DropLegacyArgs {
  apply: boolean;
}

function parseArgs(argv: string[]): DropLegacyArgs {
  return {
    apply: argv.includes("--apply"),
  };
}

function buildDropStatements(): string[] {
  return LEGACY_CAREER_RUNTIME_TABLES.map((table) => `DROP TABLE IF EXISTS "${table}" CASCADE;`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const statements = buildDropStatements();

  if (!args.apply) {
    console.log("[LegacyCareerRuntimeDrop] Dry run. Pass --apply to execute.");
    for (const statement of statements) {
      console.log(statement);
    }
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const sql = postgres(connectionString, { max: 1 });
  try {
    console.log("[LegacyCareerRuntimeDrop] Dropping legacy career runtime tables");
    for (const statement of statements) {
      console.log(`[LegacyCareerRuntimeDrop] ${statement}`);
      await sql.unsafe(statement);
    }
    console.log("[LegacyCareerRuntimeDrop] Done");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("[LegacyCareerRuntimeDrop] Failed:", error);
  process.exitCode = 1;
});

import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { REQUIRED_SCHEMA_RELEASE } from "@/lib/release/schema-release";

interface ReleaseStage {
  targetVersion?: unknown;
}

interface JuanieConfig {
  services?: Array<{
    schema?: {
      source?: unknown;
      releaseGraph?: {
        baselineVersion?: unknown;
        expand?: ReleaseStage;
        backfill?: ReleaseStage;
        verify?: ReleaseStage;
        contract?: ReleaseStage;
      };
    };
  }>;
}

function requireVersion(value: unknown, field: string): string {
  if (typeof value !== "string" || !/^\d{14}$/u.test(value)) {
    throw new Error(`${field} must be a 14-digit Atlas migration version`);
  }
  return value;
}

const config = Bun.YAML.parse(await readFile("juanie.yaml", "utf8")) as JuanieConfig;
const schema = config.services?.find((service) => service.schema?.source === "atlas")?.schema;
const graph = schema?.releaseGraph;

if (!graph) {
  throw new Error("juanie.yaml must define an Atlas releaseGraph");
}

const versions = {
  baseline: requireVersion(graph.baselineVersion, "releaseGraph.baselineVersion"),
  expand: requireVersion(graph.expand?.targetVersion, "releaseGraph.expand.targetVersion"),
  backfill: requireVersion(graph.backfill?.targetVersion, "releaseGraph.backfill.targetVersion"),
  verify: requireVersion(graph.verify?.targetVersion, "releaseGraph.verify.targetVersion"),
  contract: requireVersion(graph.contract?.targetVersion, "releaseGraph.contract.targetVersion"),
};

const orderedVersions = Object.values(versions);
for (let index = 1; index < orderedVersions.length; index += 1) {
  if (orderedVersions[index] < orderedVersions[index - 1]) {
    throw new Error("Atlas releaseGraph stages must be monotonically ordered");
  }
}

const migrationFiles = (await readdir("migrations"))
  .filter((file) => /^\d{14}_.+\.sql$/u.test(file))
  .sort();
const migrationVersions = new Set(migrationFiles.map((file) => file.slice(0, 14)));

for (const [stage, version] of Object.entries(versions)) {
  if (!migrationVersions.has(version)) {
    throw new Error(`releaseGraph.${stage} target ${version} has no migration file`);
  }
}

const markerMigration = (
  await Promise.all(
    migrationFiles.map(async (file) => ({
      file,
      sql: await readFile(join("migrations", file), "utf8"),
    })),
  )
).find(({ sql }) => sql.includes(REQUIRED_SCHEMA_RELEASE));

if (!markerMigration) {
  throw new Error(`Required runtime schema marker ${REQUIRED_SCHEMA_RELEASE} is not migrated`);
}

const markerVersion = basename(markerMigration.file).slice(0, 14);
if (markerVersion > versions.verify) {
  throw new Error(
    `Runtime schema marker ${REQUIRED_SCHEMA_RELEASE} is introduced after the verify target`,
  );
}

console.log(
  `Release contract valid: ${versions.baseline} -> ${versions.contract}; runtime marker at ${markerVersion}`,
);

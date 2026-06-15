import { closeDbConnection, db, sql } from "@/db";

async function main() {
  const [profileResult, researchResult, usageResult] = await Promise.all([
    db.execute(sql`
      update user_profiles
      set
        ai_preferences = jsonb_set(ai_preferences, '{modelSeries}', '"qwen"', true),
        updated_at = now()
      where ai_preferences ->> 'modelSeries' = 'gemini'
    `),
    db.execute(sql`
      update research_runs
      set
        model_series = 'qwen',
        updated_at = now()
      where model_series = 'gemini'
    `),
    db.execute(sql`
      update ai_usage
      set model_series = 'qwen'
      where model_series = 'gemini'
    `),
  ]);

  console.log(
    JSON.stringify(
      {
        userProfiles: profileResult.count,
        researchRuns: researchResult.count,
        aiUsageRows: usageResult.count,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbConnection();
  });

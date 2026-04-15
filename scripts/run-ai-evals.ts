import {
  chatEvalSuite,
  type EvalDomain,
  type EvalSuite,
  growthEvalSuite,
  interviewEvalSuite,
  learnEvalSuite,
  notesEvalSuite,
  runEvalSuite,
} from "@/lib/ai/evals";

const SUITES: Record<EvalDomain, EvalSuite<any>> = {
  chat: chatEvalSuite,
  growth: growthEvalSuite,
  interview: interviewEvalSuite,
  learn: learnEvalSuite,
  notes: notesEvalSuite,
};

async function main() {
  const domainArg = process.argv[2] as EvalDomain | undefined;
  const selectedDomains = domainArg
    ? ([domainArg] as EvalDomain[])
    : (Object.keys(SUITES) as EvalDomain[]);

  for (const domain of selectedDomains) {
    const suite = SUITES[domain];
    if (!suite) {
      throw new Error(`Unknown eval domain: ${domain}`);
    }

    console.log(`[AI Eval] Running ${domain}@${suite.version} (${suite.cases.length} cases)`);
    const result = await runEvalSuite(suite, {
      onCaseComplete: (caseResult) => {
        const metrics = caseResult.runtimeMetrics;
        const failedRules =
          caseResult.ruleChecks?.filter((check) => !check.passed).map((check) => check.name) ?? [];
        const metricSummary = metrics
          ? ` total=${metrics.totalMs}ms firstText=${metrics.firstTextMs ?? "-"} firstOptions=${metrics.firstOptionsMs ?? "-"} firstOutline=${metrics.firstOutlineMs ?? "-"}`
          : "";
        const ruleSummary =
          caseResult.ruleChecks && caseResult.ruleChecks.length > 0
            ? ` rules=${caseResult.ruleChecks.filter((check) => check.passed).length}/${caseResult.ruleChecks.length}`
            : "";
        const failedRuleSummary =
          failedRules.length > 0 ? ` failedRules=${failedRules.join(",")}` : "";

        console.log(
          `[AI Eval] ${caseResult.passed ? "PASS" : "FAIL"} ${caseResult.caseId} score=${caseResult.score.toFixed(2)}${ruleSummary}${failedRuleSummary}${metricSummary}`,
        );
      },
    });
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error("[AI Eval] Failed:", error);
  process.exitCode = 1;
});

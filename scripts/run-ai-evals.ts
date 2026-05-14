import {
  chatEvalSuite,
  type EvalDomain,
  type EvalSuite,
  growthEvalSuite,
  interviewEvalSuite,
  learnEvalSuite,
  notesEvalSuite,
  routingEvalSuite,
  runEvalSuite,
} from "@/tests/ai-evals";

const SUITES: Record<EvalDomain, EvalSuite<any>> = {
  chat: chatEvalSuite,
  growth: growthEvalSuite,
  interview: interviewEvalSuite,
  learn: learnEvalSuite,
  notes: notesEvalSuite,
  routing: routingEvalSuite,
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
        const quality = caseResult.quality;
        const metricSummary = metrics
          ? ` total=${metrics.totalMs}ms firstText=${metrics.firstTextMs ?? "-"} firstOptions=${metrics.firstOptionsMs ?? "-"} firstOutline=${metrics.firstOutlineMs ?? "-"}`
          : "";
        const ruleSummary =
          caseResult.ruleChecks && caseResult.ruleChecks.length > 0
            ? ` rules=${caseResult.ruleChecks.filter((check) => check.passed).length}/${caseResult.ruleChecks.length}`
            : "";
        const failedRuleSummary =
          failedRules.length > 0 ? ` failedRules=${failedRules.join(",")}` : "";
        const qualitySummary = quality
          ? ` quality=${quality.score.toFixed(2)}(${quality.source}${quality.passed ? "" : ",warn"})`
          : "";
        const status =
          caseResult.passed && quality && !quality.passed
            ? "PASS_WITH_WARN"
            : caseResult.passed
              ? "PASS"
              : "FAIL";

        console.log(
          `[AI Eval] ${status} ${caseResult.caseId} contract=${caseResult.contract.score.toFixed(2)}${qualitySummary}${ruleSummary}${failedRuleSummary}${metricSummary}`,
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

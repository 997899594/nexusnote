import {
  type EvalDomain,
  type EvalSuite,
  interviewEvalSuite,
  learnEvalSuite,
  notesEvalSuite,
  runEvalSuite,
} from "@/lib/ai/evals";

const SUITES: Record<EvalDomain, EvalSuite<any>> = {
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

    const result = await runEvalSuite(suite);
    console.log(JSON.stringify(result, null, 2));
  }
}

main().catch((error) => {
  console.error("[AI Eval] Failed:", error);
  process.exitCode = 1;
});

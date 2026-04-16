import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveDirectionKeys, sortResolvedTreesByPreference } from "@/lib/growth/compose";
import { validateMergePlannerOutput } from "@/lib/growth/merge";
import { buildGrowthProjectionArtifacts } from "@/lib/growth/projections";
import { retrieveMergeCandidateSet } from "@/lib/growth/retrieve-merge-candidates";
import {
  deriveKnowledgeInsights,
  hashKnowledgeInsightInputs,
} from "@/lib/knowledge/insights/derive";
import {
  buildCourseBlueprintAlignmentBrief,
  buildLearningAlignmentBrief,
  buildLearnQuickPrompts,
  formatCourseBlueprintAlignmentBrief,
  formatLearningAlignmentBrief,
} from "@/lib/learning/alignment";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function loadFixture<T>(name: string): T {
  const fixturePath = join(process.cwd(), "scripts", "fixtures", "growth", name);
  return JSON.parse(readFileSync(fixturePath, "utf8")) as T;
}

function checkDirectionKeyStability() {
  const fixture = loadFixture<{
    trees: Parameters<typeof resolveDirectionKeys>[0]["trees"];
    previousDirections: Parameters<typeof resolveDirectionKeys>[0]["previousDirections"];
    expectedDirectionKeys: string[];
  }>("direction-identity.json");

  const resolved = resolveDirectionKeys({
    trees: fixture.trees,
    previousDirections: fixture.previousDirections,
  });

  assert(
    JSON.stringify(resolved.map((tree) => tree.directionKey)) ===
      JSON.stringify(fixture.expectedDirectionKeys),
    "expected fixture direction keys to remain stable",
  );
}

function checkPreferenceOrdering() {
  const fixture = loadFixture<
    Parameters<typeof sortResolvedTreesByPreference>[0] & {
      expectedDirectionKeys: string[];
    }
  >("preference-ordering.json");
  const { expectedDirectionKeys, ...input } = fixture;
  const sorted = sortResolvedTreesByPreference(input);

  assert(
    JSON.stringify(sorted.map((tree) => tree.directionKey)) ===
      JSON.stringify(expectedDirectionKeys),
    "expected preference ordering to remain stable",
  );
}

function checkCandidateRetrieval() {
  const fixture = loadFixture<
    Parameters<typeof retrieveMergeCandidateSet>[0] & { expectedNodeIds: string[] }
  >("candidate-retrieval.json");
  const { expectedNodeIds, ...input } = fixture;
  const candidateSet = retrieveMergeCandidateSet(input);

  assert(candidateSet.nodes.length === expectedNodeIds.length, "expected fixture candidate count");
  assert(
    JSON.stringify(candidateSet.nodes.map((node) => node.id)) === JSON.stringify(expectedNodeIds),
    "expected lexical retrieval fixture to keep target nodes stable",
  );
}

function checkMergeValidation() {
  const fixture = loadFixture<{
    output: Parameters<typeof validateMergePlannerOutput>[0]["output"];
    allowedTargetNodeIds: string[];
    allowedEvidenceIds: string[];
    maxNewNodes: number;
    expectedDecisionCount: number;
    expectedEdgeCount: number;
  }>("merge-validation.json");

  const validated = validateMergePlannerOutput({
    output: fixture.output,
    allowedTargetNodeIds: new Set(fixture.allowedTargetNodeIds),
    allowedEvidenceIds: new Set(fixture.allowedEvidenceIds),
    maxNewNodes: fixture.maxNewNodes,
  });

  assert(
    validated.decisions.length === fixture.expectedDecisionCount,
    "expected merge validation fixture to keep only valid decisions",
  );
  assert(
    validated.prerequisiteEdges.length === fixture.expectedEdgeCount,
    "expected merge validation fixture to drop cycles and self edges",
  );
}

function checkLearnAlignment() {
  const fixture = loadFixture<{
    cases: Array<{
      name: string;
      input: Parameters<typeof buildLearningAlignmentBrief>[0];
      expected: {
        relation: ReturnType<typeof buildLearningAlignmentBrief>["relation"];
        focusTitle: string | null;
        relevantInsightTitles: string[];
        summaryIncludes: string[];
      };
    }>;
  }>("learn-alignment.json");

  for (const testCase of fixture.cases) {
    const brief = buildLearningAlignmentBrief(testCase.input);
    const formatted = formatLearningAlignmentBrief(brief);
    const compact = formatLearningAlignmentBrief(brief, "compact");

    assert(
      brief.relation === testCase.expected.relation,
      `expected ${testCase.name} relation to remain stable`,
    );
    assert(
      brief.focusTitle === testCase.expected.focusTitle,
      `expected ${testCase.name} focus title to remain stable`,
    );
    assert(
      JSON.stringify(brief.relevantInsightTitles) ===
        JSON.stringify(testCase.expected.relevantInsightTitles),
      `expected ${testCase.name} relevant insights to remain stable`,
    );

    for (const snippet of testCase.expected.summaryIncludes) {
      assert(
        brief.summary.includes(snippet),
        `expected ${testCase.name} summary to include ${snippet}`,
      );
      assert(
        formatted.includes(snippet) || compact.includes(snippet),
        `expected ${testCase.name} formatted output to include ${snippet}`,
      );
    }

    assert(brief.emphasis.length >= 3, `expected ${testCase.name} to keep emphasis guidance`);
  }
}

function checkCourseBlueprintAlignment() {
  const fixture = loadFixture<{
    cases: Array<{
      name: string;
      input: Parameters<typeof buildCourseBlueprintAlignmentBrief>[0];
      expected: {
        relation: ReturnType<typeof buildCourseBlueprintAlignmentBrief>["relation"];
        focusTitle: string | null;
        relevantInsightTitles: string[];
        summaryIncludes: string[];
      };
    }>;
  }>("course-blueprint-alignment.json");

  for (const testCase of fixture.cases) {
    const brief = buildCourseBlueprintAlignmentBrief(testCase.input);
    const formatted = formatCourseBlueprintAlignmentBrief(brief);

    assert(
      brief.relation === testCase.expected.relation,
      `expected ${testCase.name} relation to remain stable`,
    );
    assert(
      brief.focusTitle === testCase.expected.focusTitle,
      `expected ${testCase.name} focus title to remain stable`,
    );
    assert(
      JSON.stringify(brief.relevantInsightTitles) ===
        JSON.stringify(testCase.expected.relevantInsightTitles),
      `expected ${testCase.name} relevant insights to remain stable`,
    );

    for (const snippet of testCase.expected.summaryIncludes) {
      assert(
        brief.summary.includes(snippet),
        `expected ${testCase.name} summary to include ${snippet}`,
      );
      assert(
        formatted.includes(snippet),
        `expected ${testCase.name} formatted output to include ${snippet}`,
      );
    }

    assert(brief.emphasis.length >= 3, `expected ${testCase.name} to keep emphasis guidance`);
  }
}

function checkLearnQuickPrompts() {
  const fixture = loadFixture<{
    cases: Array<{
      name: string;
      input: Parameters<typeof buildLearnQuickPrompts>[0];
      expectedPrompts: string[];
    }>;
  }>("learn-quick-prompts.json");

  for (const testCase of fixture.cases) {
    const prompts = buildLearnQuickPrompts(testCase.input);
    assert(
      JSON.stringify(prompts) === JSON.stringify(testCase.expectedPrompts),
      `expected ${testCase.name} quick prompts to remain stable`,
    );
  }
}

function checkKnowledgeInsightDerivation() {
  const fixture = loadFixture<{
    cases: Array<{
      name: string;
      input: Parameters<typeof deriveKnowledgeInsights>[0];
      expected: {
        inputHash: string;
        items: Array<{
          kind: ReturnType<typeof deriveKnowledgeInsights>[number]["kind"];
          title: string;
          confidence: number;
          evidenceIds: string[];
          summaryIncludes?: string[];
        }>;
      };
    }>;
  }>("insight-derivation.json");

  for (const testCase of fixture.cases) {
    const actualHash = hashKnowledgeInsightInputs(testCase.input);
    const insights = deriveKnowledgeInsights(testCase.input);

    assert(
      actualHash === testCase.expected.inputHash,
      `expected ${testCase.name} insight input hash to remain stable`,
    );
    assert(
      insights.length === testCase.expected.items.length,
      `expected ${testCase.name} insight count to remain stable`,
    );

    testCase.expected.items.forEach((expectedItem, index) => {
      const actual = insights[index];
      assert(actual.kind === expectedItem.kind, `expected ${testCase.name} item ${index} kind`);
      assert(actual.title === expectedItem.title, `expected ${testCase.name} item ${index} title`);
      assert(
        actual.confidence === expectedItem.confidence,
        `expected ${testCase.name} item ${index} confidence`,
      );
      assert(
        JSON.stringify(actual.evidenceIds) === JSON.stringify(expectedItem.evidenceIds),
        `expected ${testCase.name} item ${index} evidence ids`,
      );

      for (const snippet of expectedItem.summaryIncludes ?? []) {
        assert(
          actual.summary.includes(snippet),
          `expected ${testCase.name} item ${index} summary to include ${snippet}`,
        );
      }
    });
  }
}

function checkProjectionDerivation() {
  const fixture = loadFixture<{
    cases: Array<{
      name: string;
      input: Parameters<typeof buildGrowthProjectionArtifacts>[0];
      expected: {
        recommendedDirectionKey: string | null;
        focusDirectionKey: string | null;
        focusNodeTitle: string | null;
        currentDirectionTitle: string | null;
        treesCount: number;
        supportingCoursesCount: number;
        supportingChaptersCount: number;
        metrics: {
          total: number;
          mastered: number;
          inProgress: number;
          ready: number;
          locked: number;
          averageProgress: number;
        } | null;
      };
    }>;
  }>("projection-derivation.json");

  for (const testCase of fixture.cases) {
    const actual = buildGrowthProjectionArtifacts(testCase.input);

    assert(
      actual.snapshot.recommendedDirectionKey === testCase.expected.recommendedDirectionKey,
      `expected ${testCase.name} recommended direction to remain stable`,
    );
    assert(
      actual.focusTree?.directionKey ?? null === testCase.expected.focusDirectionKey,
      `expected ${testCase.name} focus direction to remain stable`,
    );
    assert(
      actual.focusNode?.title ?? null === testCase.expected.focusNodeTitle,
      `expected ${testCase.name} focus node title to remain stable`,
    );
    assert(
      actual.profilePayload.currentDirection?.title ??
        null === testCase.expected.currentDirectionTitle,
      `expected ${testCase.name} current direction title to remain stable`,
    );
    assert(
      actual.snapshot.trees.length === testCase.expected.treesCount,
      `expected ${testCase.name} tree count to remain stable`,
    );
    assert(
      (actual.profilePayload.currentDirection?.supportingCoursesCount ?? 0) ===
        testCase.expected.supportingCoursesCount,
      `expected ${testCase.name} supporting course count to remain stable`,
    );
    assert(
      (actual.profilePayload.currentDirection?.supportingChaptersCount ?? 0) ===
        testCase.expected.supportingChaptersCount,
      `expected ${testCase.name} supporting chapter count to remain stable`,
    );
    assert(
      JSON.stringify(actual.profilePayload.metrics) === JSON.stringify(testCase.expected.metrics),
      `expected ${testCase.name} metrics to remain stable`,
    );
  }
}

function main() {
  checkDirectionKeyStability();
  checkPreferenceOrdering();
  checkCandidateRetrieval();
  checkMergeValidation();
  checkLearnAlignment();
  checkCourseBlueprintAlignment();
  checkLearnQuickPrompts();
  checkKnowledgeInsightDerivation();
  checkProjectionDerivation();
  console.log("[GrowthCheck] stable");
}

main();

import { embedMany } from "ai";
import { aiProvider } from "@/lib/ai/core/provider";
import {
  type ComposeGraph,
  type ComposePreference,
  type ComposePreviousSummary,
  jaccardOverlap,
  slugify,
} from "@/lib/growth/compose-shared";

export interface DirectionCountGuidance {
  min: number;
  max: number;
  signalStrength: "weak" | "mixed" | "strong";
}

export interface GrowthDirectionPlan {
  matchPreviousDirectionKey?: string;
  keySeed: string;
  supportingNodeRefs: string[];
}

export interface GrowthDirectionPlannerResult {
  recommendedDirectionIndex: number;
  directions: GrowthDirectionPlan[];
  guidance: DirectionCountGuidance;
}

interface NodeProfile {
  node: ComposeGraph["nodes"][number];
  vector: number[];
  score: number;
}

interface DirectionCluster {
  profiles: NodeProfile[];
  score: number;
  centroid: number[];
}

export type GrowthDirectionEmbeddingProvider = (texts: string[]) => Promise<number[][]>;

const MAX_DIRECTIONS = 5;
const CLUSTER_AFFINITY_THRESHOLD = 0.85;
const GRAPH_EDGE_AFFINITY = 0.96;
const CHAPTER_REF_AFFINITY = 0.78;
const SNIPPET_REF_AFFINITY = 0.99;
const KEY_SEED_LABEL_COUNT = 2;

function hasGrowthSignal(node: ComposeGraph["nodes"][number]): boolean {
  return (
    node.progress > 0 || node.evidenceScore > 0 || node.courseCount > 0 || node.chapterCount > 0
  );
}

function computeNodeScore(node: ComposeGraph["nodes"][number]): number {
  const stateBonus = node.state === "mastered" ? 20 : node.state === "in_progress" ? 12 : 0;
  return (
    node.evidenceScore * 1.1 +
    node.progress * 1.2 +
    node.courseCount * 8 +
    node.chapterCount * 2 +
    stateBonus
  );
}

function buildSemanticText(node: ComposeGraph["nodes"][number]): string {
  return [`Capability: ${node.canonicalLabel}`, node.summary ? `Summary: ${node.summary}` : null]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (magnitude === 0) {
    return vector;
  }

  return vector.map((value) => value / magnitude);
}

function cosineSimilarity(left: number[], right: number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += left[index] * right[index];
  }

  return sum;
}

function weightedCentroid(profiles: NodeProfile[]): number[] {
  const dimension = profiles[0]?.vector.length ?? 0;
  if (dimension === 0) {
    return [];
  }

  const values = Array.from({ length: dimension }, () => 0);
  const totalWeight = profiles.reduce((sum, profile) => sum + Math.max(1, profile.score), 0);

  for (const profile of profiles) {
    const weight = Math.max(1, profile.score);
    for (let index = 0; index < dimension; index += 1) {
      values[index] += profile.vector[index] * weight;
    }
  }

  return normalizeVector(values.map((value) => value / totalWeight));
}

function compareProfiles(left: NodeProfile, right: NodeProfile): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.node.canonicalLabel.localeCompare(right.node.canonicalLabel, "zh-Hans-CN");
}

function compareClusters(left: DirectionCluster, right: DirectionCluster): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  return left.profiles[0].node.canonicalLabel.localeCompare(
    right.profiles[0].node.canonicalLabel,
    "zh-Hans-CN",
  );
}

async function embedDirectionNodeTexts(texts: string[]): Promise<number[][]> {
  if (!aiProvider.isConfigured()) {
    throw new Error("Growth direction planning requires the configured embedding provider.");
  }

  const { embeddings } = await embedMany({
    model: aiProvider.embeddingModel,
    values: texts,
  });

  if (embeddings.length !== texts.length) {
    throw new Error(
      `Growth direction embedding count mismatch: texts=${texts.length}, embeddings=${embeddings.length}`,
    );
  }

  return embeddings;
}

async function buildNodeProfiles(
  graph: ComposeGraph,
  embeddingProvider: GrowthDirectionEmbeddingProvider,
): Promise<NodeProfile[]> {
  const signalNodes = graph.nodes.filter(hasGrowthSignal);
  const texts = signalNodes.map(buildSemanticText);
  const embeddings = await embeddingProvider(texts);

  return signalNodes
    .map((node, index) => ({
      node,
      vector: normalizeVector(embeddings[index] ?? []),
      score: computeNodeScore(node),
    }))
    .sort(compareProfiles);
}

function buildGraphAffinityMap(graph: ComposeGraph): Map<string, number> {
  const affinities = new Map<string, number>();

  const semanticRefIndex = new Map<string, string[]>();
  for (const node of graph.nodes) {
    for (const ref of node.semanticRefs ?? []) {
      const nodeIds = semanticRefIndex.get(ref) ?? [];
      nodeIds.push(node.id);
      semanticRefIndex.set(ref, nodeIds);
    }
  }

  for (const [ref, nodeIds] of semanticRefIndex.entries()) {
    const affinity = ref.startsWith("snippet:") ? SNIPPET_REF_AFFINITY : CHAPTER_REF_AFFINITY;
    for (let leftIndex = 0; leftIndex < nodeIds.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodeIds.length; rightIndex += 1) {
        setAffinity(affinities, nodeIds[leftIndex], nodeIds[rightIndex], affinity);
      }
    }
  }

  for (const edge of graph.prerequisiteEdges) {
    setAffinity(affinities, edge.from, edge.to, GRAPH_EDGE_AFFINITY);
  }

  return affinities;
}

function setAffinity(
  affinities: Map<string, number>,
  leftNodeId: string,
  rightNodeId: string,
  value: number,
): void {
  const forwardKey = `${leftNodeId}:${rightNodeId}`;
  const reverseKey = `${rightNodeId}:${leftNodeId}`;
  const nextValue = Math.max(
    value,
    affinities.get(forwardKey) ?? 0,
    affinities.get(reverseKey) ?? 0,
  );

  affinities.set(forwardKey, nextValue);
  affinities.set(reverseKey, nextValue);
}

function clusterAffinity(
  left: DirectionCluster,
  right: DirectionCluster,
  graphAffinities: Map<string, number>,
): number {
  let bestGraphAffinity = 0;

  for (const leftProfile of left.profiles) {
    for (const rightProfile of right.profiles) {
      bestGraphAffinity = Math.max(
        bestGraphAffinity,
        graphAffinities.get(`${leftProfile.node.id}:${rightProfile.node.id}`) ?? 0,
      );
    }
  }

  return Math.max(bestGraphAffinity, cosineSimilarity(left.centroid, right.centroid));
}

function createCluster(profiles: NodeProfile[]): DirectionCluster {
  const sortedProfiles = [...profiles].sort(compareProfiles);
  const evidenceBreadthBonus = Math.min(32, Math.max(0, sortedProfiles.length - 1) * 16);

  return {
    profiles: sortedProfiles,
    score: sortedProfiles.reduce((sum, profile) => sum + profile.score, 0) + evidenceBreadthBonus,
    centroid: weightedCentroid(sortedProfiles),
  };
}

function findBestClusterPair(
  clusters: DirectionCluster[],
  graphAffinities: Map<string, number>,
): { leftIndex: number; rightIndex: number; affinity: number } | null {
  let best: { leftIndex: number; rightIndex: number; affinity: number } | null = null;

  for (let leftIndex = 0; leftIndex < clusters.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < clusters.length; rightIndex += 1) {
      const affinity = clusterAffinity(clusters[leftIndex], clusters[rightIndex], graphAffinities);

      if (!best || affinity > best.affinity) {
        best = { leftIndex, rightIndex, affinity };
      }
    }
  }

  return best;
}

function mergeClusterPair(
  clusters: DirectionCluster[],
  pair: { leftIndex: number; rightIndex: number },
): DirectionCluster[] {
  const merged = createCluster([
    ...clusters[pair.leftIndex].profiles,
    ...clusters[pair.rightIndex].profiles,
  ]);

  return clusters
    .filter((_, index) => index !== pair.leftIndex && index !== pair.rightIndex)
    .concat(merged)
    .sort(compareClusters);
}

function buildSemanticClusters(profiles: NodeProfile[], graph: ComposeGraph): DirectionCluster[] {
  const graphAffinities = buildGraphAffinityMap(graph);
  let clusters = profiles.map((profile) => createCluster([profile])).sort(compareClusters);

  while (clusters.length > 1) {
    const bestPair = findBestClusterPair(clusters, graphAffinities);
    if (!bestPair) {
      break;
    }

    if (bestPair.affinity < CLUSTER_AFFINITY_THRESHOLD) {
      break;
    }

    clusters = mergeClusterPair(clusters, bestPair);
  }

  return clusters.sort(compareClusters);
}

export function deriveDirectionCountGuidance(graph: ComposeGraph): DirectionCountGuidance {
  const signalNodes = graph.nodes.filter(hasGrowthSignal);
  const strongNodes = signalNodes.filter(
    (node) => node.progress >= 60 || node.evidenceScore >= 60,
  ).length;

  if (signalNodes.length <= 2) {
    return { min: 1, max: Math.min(2, Math.max(1, signalNodes.length)), signalStrength: "weak" };
  }

  if (signalNodes.length >= 8) {
    return {
      min: 3,
      max: Math.min(MAX_DIRECTIONS, signalNodes.length),
      signalStrength: strongNodes >= 3 ? "strong" : "mixed",
    };
  }

  if (signalNodes.length >= 4) {
    return {
      min: 2,
      max: Math.min(4, signalNodes.length),
      signalStrength: strongNodes >= 2 ? "strong" : "mixed",
    };
  }

  return { min: 1, max: Math.min(3, signalNodes.length), signalStrength: "mixed" };
}

function buildKeySeed(cluster: DirectionCluster): string {
  return slugify(
    cluster.profiles
      .slice(0, KEY_SEED_LABEL_COUNT)
      .map((profile) => profile.node.canonicalLabel)
      .join(" "),
  );
}

function matchPreviousDirection(
  supportingNodeRefs: string[],
  previousSummary: ComposePreviousSummary,
): string | undefined {
  const bestMatch = previousSummary.trees
    .map((tree) => ({
      directionKey: tree.directionKey,
      overlap: jaccardOverlap(supportingNodeRefs, tree.supportingNodeRefs),
    }))
    .sort((left, right) => right.overlap - left.overlap)[0];

  return bestMatch && bestMatch.overlap >= 0.45 ? bestMatch.directionKey : undefined;
}

export async function planGrowthDirections(params: {
  userId: string;
  graph: ComposeGraph;
  preference: ComposePreference;
  previousSummary: ComposePreviousSummary;
  recordUsage?: boolean;
  embeddingProvider?: GrowthDirectionEmbeddingProvider;
}): Promise<GrowthDirectionPlannerResult> {
  const guidance = deriveDirectionCountGuidance(params.graph);
  const profiles = await buildNodeProfiles(
    params.graph,
    params.embeddingProvider ?? embedDirectionNodeTexts,
  );
  const clusters = buildSemanticClusters(profiles, params.graph);
  const directionCount = Math.min(guidance.max, Math.max(guidance.min, clusters.length));
  const selectedClusters = clusters.slice(0, directionCount);

  return {
    recommendedDirectionIndex: 0,
    directions: selectedClusters.map((cluster) => {
      const supportingNodeRefs = cluster.profiles.map((profile) => profile.node.id);

      return {
        keySeed: buildKeySeed(cluster),
        matchPreviousDirectionKey: matchPreviousDirection(
          supportingNodeRefs,
          params.previousSummary,
        ),
        supportingNodeRefs,
      };
    }),
    guidance,
  };
}

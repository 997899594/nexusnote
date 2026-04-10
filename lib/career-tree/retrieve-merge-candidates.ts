import type { ExtractedCareerEvidenceItem } from "@/lib/career-tree/extract";

export interface MergeCandidateNode {
  id: string;
  canonicalLabel: string;
  summary: string | null;
}

export interface MergeCandidateEvidenceLink {
  nodeId: string;
  title: string;
  summary: string | null;
}

export interface MergeCandidatePrerequisiteEdge {
  fromNodeId: string;
  toNodeId: string;
}

export interface MergeCandidateSet {
  nodes: MergeCandidateNode[];
  evidenceLinks: MergeCandidateEvidenceLink[];
  prerequisiteEdges: MergeCandidatePrerequisiteEdge[];
}

const MAX_PER_EVIDENCE = 8;
const MAX_NODES = 40;
const MAX_EVIDENCE_LINKS = 60;
const MAX_PREREQUISITE_EDGES = 40;

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function overlapScore(left: string[], right: string[]): number {
  if (left.length === 0 || right.length === 0) {
    return 0;
  }

  const rightSet = new Set(right);
  let score = 0;

  for (const token of left) {
    if (rightSet.has(token)) {
      score += token.length >= 5 ? 2 : 1;
    }
  }

  return score;
}

function scoreEvidenceToNode(
  evidence: ExtractedCareerEvidenceItem,
  node: MergeCandidateNode,
): number {
  const evidenceTokens = tokenize(
    `${evidence.title} ${evidence.summary} ${evidence.evidenceSnippets.join(" ")}`,
  );
  const nodeTokens = tokenize(`${node.canonicalLabel} ${node.summary ?? ""}`);

  return overlapScore(evidenceTokens, nodeTokens);
}

export function retrieveMergeCandidateSet(params: {
  evidenceItems: ExtractedCareerEvidenceItem[];
  existingNodes: MergeCandidateNode[];
  existingEvidenceLinks: MergeCandidateEvidenceLink[];
  existingPrerequisiteEdges: MergeCandidatePrerequisiteEdge[];
}): MergeCandidateSet {
  const selectedNodeIds = new Set<string>();

  for (const evidenceItem of params.evidenceItems) {
    const topCandidates = params.existingNodes
      .map((node) => ({ nodeId: node.id, score: scoreEvidenceToNode(evidenceItem, node) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_PER_EVIDENCE);

    for (const candidate of topCandidates) {
      selectedNodeIds.add(candidate.nodeId);
      if (selectedNodeIds.size >= MAX_NODES) {
        break;
      }
    }

    if (selectedNodeIds.size >= MAX_NODES) {
      break;
    }
  }

  const nodes = params.existingNodes
    .filter((node) => selectedNodeIds.has(node.id))
    .slice(0, MAX_NODES);
  const nodeIdSet = new Set(nodes.map((node) => node.id));

  const evidenceLinks = params.existingEvidenceLinks
    .filter((link) => nodeIdSet.has(link.nodeId))
    .slice(0, MAX_EVIDENCE_LINKS);

  const prerequisiteEdges = params.existingPrerequisiteEdges
    .filter((edge) => nodeIdSet.has(edge.fromNodeId) && nodeIdSet.has(edge.toNodeId))
    .slice(0, MAX_PREREQUISITE_EDGES);

  return {
    nodes,
    evidenceLinks,
    prerequisiteEdges,
  };
}

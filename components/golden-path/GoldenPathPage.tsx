import type { GoldenPathSnapshot } from "@/lib/career-tree/types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { GoldenPathExplorer } from "./GoldenPathExplorer";

interface GoldenPathPageProps {
  snapshot: GoldenPathSnapshot;
  insights: KnowledgeInsight[];
}

export function GoldenPathPage({ snapshot, insights }: GoldenPathPageProps) {
  return <GoldenPathExplorer snapshot={snapshot} insights={insights} />;
}

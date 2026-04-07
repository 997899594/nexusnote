import type { GoldenPathSnapshot } from "@/lib/golden-path/types";
import { GoldenPathExplorer } from "./GoldenPathExplorer";

interface GoldenPathPageProps {
  snapshot: GoldenPathSnapshot;
  selectedPathId?: string;
}

export function GoldenPathPage({ snapshot, selectedPathId }: GoldenPathPageProps) {
  return <GoldenPathExplorer snapshot={snapshot} selectedPathId={selectedPathId} />;
}

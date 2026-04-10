import type { GoldenPathSnapshot } from "@/lib/golden-path/types";
import { GoldenPathExplorer } from "./GoldenPathExplorer";

interface GoldenPathPageProps {
  snapshot: GoldenPathSnapshot;
}

export function GoldenPathPage({ snapshot }: GoldenPathPageProps) {
  return <GoldenPathExplorer snapshot={snapshot} />;
}

import type {
  FocusSnapshotProjection,
  ProfileSnapshotProjection,
} from "@/lib/growth/projection-types";
import type { CareerTreeSnapshot } from "@/lib/growth/types";
import type { KnowledgeInsight } from "@/lib/knowledge/insights";
import { CareerTreesExplorer } from "./CareerTreesExplorer";

interface CareerTreesPageProps {
  snapshot: CareerTreeSnapshot;
  insights: KnowledgeInsight[];
  focusSnapshot: FocusSnapshotProjection | null;
  profileSnapshot: ProfileSnapshotProjection | null;
}

export function CareerTreesPage({
  snapshot,
  insights,
  focusSnapshot,
  profileSnapshot,
}: CareerTreesPageProps) {
  return (
    <CareerTreesExplorer
      snapshot={snapshot}
      insights={insights}
      focusSnapshot={focusSnapshot}
      profileSnapshot={profileSnapshot}
    />
  );
}

export type GoldenPathTier = "foundation" | "core" | "advanced";

export type GoldenPathSkillState = "mastered" | "in_progress" | "ready" | "locked";

export interface GoldenPathDomainDefinition {
  id: string;
  name: string;
  description: string;
  adjacentDomainIds?: string[];
}

export interface GoldenPathSkillDefinition {
  id: string;
  name: string;
  description: string;
  domainIds: string[];
  tier: GoldenPathTier;
  importance: number;
  aliases: string[];
  prerequisites?: string[];
}

export interface GoldenPathPathProjection {
  id: string;
  name: string;
  tagline: string;
  description: string;
  outcomes: string[];
  domainIds: string[];
  skillIds: string[];
}

export interface GoldenPathEvidenceSummary {
  masterySignals: number;
  courseCount: number;
  chapterCount: number;
  highlightCount: number;
  noteCount: number;
}

export interface GoldenPathNodeSnapshot extends GoldenPathSkillDefinition {
  state: GoldenPathSkillState;
  coverageScore: number;
  masteryScore: number;
  progressScore: number;
  evidence: GoldenPathEvidenceSummary;
  linkedCourseIds: string[];
  linkedChapterKeys: string[];
}

export interface GoldenPathDomainSnapshot extends GoldenPathDomainDefinition {
  progress: number;
  masteredCount: number;
  inProgressCount: number;
  readyCount: number;
  lockedCount: number;
  nodes: GoldenPathNodeSnapshot[];
}

export interface GoldenPathLinkedChapter {
  key: string;
  title: string;
  chapterIndex: number;
  matchedSkills: string[];
}

export interface GoldenPathLinkedCourse {
  courseId: string;
  title: string;
  progressPercent: number;
  matchedSkills: string[];
  matchedChapters: GoldenPathLinkedChapter[];
  updatedAt: Date | null;
}

export interface GoldenPathRouteSnapshot {
  id: string;
  name: string;
  tagline: string;
  description: string;
  outcomes: string[];
  source: "projection";
  domainIds: string[];
  progress: number;
  fitScore: number;
  masteredCount: number;
  inProgressCount: number;
  readyCount: number;
  lockedCount: number;
  nextActions: GoldenPathNodeSnapshot[];
  criticalGaps: GoldenPathNodeSnapshot[];
  domains: GoldenPathDomainSnapshot[];
  linkedLearning: GoldenPathLinkedCourse[];
}

export interface GoldenPathFutureRoute {
  id: string;
  name: string;
  fitScore: number;
  progress: number;
  missingSkills: string[];
}

export interface GoldenPathSnapshot {
  mainRouteId: string;
  routes: GoldenPathRouteSnapshot[];
  futureRoutes: GoldenPathFutureRoute[];
  totals: {
    routeCount: number;
    activeCourseCount: number;
    masteredCount: number;
    inProgressCount: number;
    readyCount: number;
  };
}

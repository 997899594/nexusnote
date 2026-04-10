import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { courseChapterSkillMappings, courseProgress, courseSkillMappings, courses, db } from "@/db";
import { getGoldenPathTag } from "@/lib/cache/tags";
import {
  GOLDEN_PATH_DOMAINS,
  GOLDEN_PATH_PROJECTION_PRIORS,
  GOLDEN_PATH_SKILLS,
} from "@/lib/golden-path/ontology";
import { getUserGoldenPathPreference } from "@/lib/golden-path/preferences";
import type {
  GoldenPathChapterSkill,
  GoldenPathCourseContext,
  GoldenPathDomainSnapshot,
  GoldenPathFutureRoute,
  GoldenPathLinkedCourse,
  GoldenPathNodeSnapshot,
  GoldenPathRouteSnapshot,
  GoldenPathSnapshot,
} from "@/lib/golden-path/types";

interface OutlineSection {
  title?: string;
  description?: string;
}

interface CourseSectionArtifact {
  key: string;
  title: string;
  chapterIndex: number;
  searchText: string;
  completed: boolean;
}

interface OutlineChapter {
  title?: string;
  description?: string;
  skillIds?: string[];
  sections?: OutlineSection[];
}

interface OutlineData {
  courseSkillIds?: string[];
  chapters?: OutlineChapter[];
}

interface CourseChapterArtifact {
  key: string;
  title: string;
  chapterIndex: number;
  searchText: string;
  explicitSkillIds: string[];
  totalSections: number;
  completedSections: number;
}

interface CourseArtifact {
  id: string;
  title: string;
  progressPercent: number;
  currentChapter: number;
  updatedAt: Date | null;
  searchText: string;
  explicitSkillIds: string[];
  chapters: CourseChapterArtifact[];
  sections: CourseSectionArtifact[];
}

interface GoldenPathBaseData {
  coursesById: Map<string, CourseArtifact>;
  skillSnapshots: GoldenPathNodeSnapshot[];
  routeSnapshots: GoldenPathRouteSnapshot[];
  futureRoutes: GoldenPathFutureRoute[];
  recommendedRouteId: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeSkillIds(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return uniqueStrings(values.filter((value): value is string => typeof value === "string"));
}

function matchAliasesScore(haystack: string, aliases: string[]): number {
  if (!haystack) {
    return 0;
  }

  let score = 0;

  for (const alias of uniqueStrings(aliases.map((item) => normalizeText(item)))) {
    if (!alias || alias.length < 2) {
      continue;
    }

    if (haystack.includes(alias)) {
      score += alias.length >= 5 ? 2 : 1;
    }
  }

  return score;
}

function buildCourseArtifacts(
  rows: Array<{
    id: string;
    title: string;
    description: string | null;
    outlineData: unknown;
    currentChapter: number | null;
    updatedAt: Date | null;
    completedSections: string[] | null;
    completedAt: Date | null;
  }>,
): CourseArtifact[] {
  return rows.map((row) => {
    const outline = (row.outlineData ?? {}) as OutlineData;
    const completedSectionIds = new Set(
      Array.isArray(row.completedSections) ? row.completedSections : [],
    );
    const sections: CourseSectionArtifact[] = [];
    const explicitCourseSkillIds = normalizeSkillIds(outline.courseSkillIds);
    const chapters = (outline.chapters ?? []).map((chapter, index) => {
      const chapterTitle = chapter.title?.trim() || `第 ${index + 1} 章`;
      const explicitChapterSkillIds = normalizeSkillIds(chapter.skillIds);
      const chapterSections = (chapter.sections ?? []).map((section, sectionIndex) => {
        const sectionKey = `section-${index + 1}-${sectionIndex + 1}`;
        const sectionTitle = section.title?.trim() || `第 ${index + 1}.${sectionIndex + 1} 节`;
        const sectionArtifact = {
          key: sectionKey,
          title: sectionTitle,
          chapterIndex: index + 1,
          searchText: normalizeText(`${sectionTitle} ${section.description ?? ""}`),
          completed: completedSectionIds.has(sectionKey),
        };
        sections.push(sectionArtifact);
        return sectionArtifact;
      });
      const chapterText = normalizeText(
        [
          chapterTitle,
          chapter.description ?? "",
          ...chapterSections.flatMap((section) => [section.title, section.searchText]),
        ].join(" "),
      );

      return {
        key: `${row.id}:chapter:${index + 1}`,
        title: chapterTitle,
        chapterIndex: index + 1,
        searchText: chapterText,
        explicitSkillIds: explicitChapterSkillIds,
        totalSections: chapterSections.length,
        completedSections: chapterSections.filter((section) => section.completed).length,
      };
    });

    const totalSections = (outline.chapters ?? []).reduce(
      (count, chapter) => count + (chapter.sections?.length ?? 0),
      0,
    );

    const completedSections = Array.isArray(row.completedSections)
      ? row.completedSections.length
      : 0;
    const progressPercent =
      totalSections > 0
        ? clampPercent((completedSections / totalSections) * 100)
        : row.completedAt
          ? 100
          : 0;

    return {
      id: row.id,
      title: row.title,
      progressPercent,
      currentChapter: row.currentChapter ?? 0,
      updatedAt: row.updatedAt,
      searchText: normalizeText(
        [row.title, row.description ?? "", ...chapters.map((chapter) => chapter.searchText)].join(
          " ",
        ),
      ),
      explicitSkillIds: explicitCourseSkillIds,
      chapters,
      sections,
    };
  });
}

function createProjectionDescription(domainNames: string[]): string {
  if (domainNames.length === 0) {
    return "围绕当前学习证据生成的个性化成长主线。";
  }

  return `围绕 ${domainNames.join("、")} 形成的当前成长主线。`;
}

function toChapterSkill(skill: GoldenPathNodeSnapshot): GoldenPathChapterSkill {
  return {
    id: skill.id,
    name: skill.name,
    state: skill.state,
    progressScore: skill.progressScore,
  };
}

async function loadGoldenPathBase(userId: string): Promise<GoldenPathBaseData> {
  const courseRows = await db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      outlineData: courses.outlineData,
      currentChapter: courseProgress.currentChapter,
      updatedAt: courses.updatedAt,
      completedSections: courseProgress.completedSections,
      completedAt: courseProgress.completedAt,
    })
    .from(courses)
    .leftJoin(
      courseProgress,
      and(eq(courseProgress.courseId, courses.id), eq(courseProgress.userId, userId)),
    )
    .where(eq(courses.userId, userId))
    .orderBy(desc(courses.updatedAt));

  const coursesById = new Map(
    buildCourseArtifacts(courseRows).map((course) => [course.id, course]),
  );
  const courseIds = [...coursesById.keys()];
  const chapterByKey = new Map(
    [...coursesById.values()].flatMap((course) =>
      course.chapters.map((chapter) => [chapter.key, { courseId: course.id, chapter }] as const),
    ),
  );
  const [persistedCourseMappings, persistedChapterMappings] =
    courseIds.length > 0
      ? await Promise.all([
          db
            .select({
              courseId: courseSkillMappings.courseId,
              skillKey: courseSkillMappings.skillKey,
            })
            .from(courseSkillMappings)
            .where(inArray(courseSkillMappings.courseId, courseIds)),
          db
            .select({
              courseId: courseChapterSkillMappings.courseId,
              chapterIndex: courseChapterSkillMappings.chapterIndex,
              skillKey: courseChapterSkillMappings.skillKey,
            })
            .from(courseChapterSkillMappings)
            .where(inArray(courseChapterSkillMappings.courseId, courseIds)),
        ])
      : [[], []];

  const persistedCourseIdsBySkill = new Map<string, Set<string>>();
  const persistedChapterKeysBySkill = new Map<string, Set<string>>();
  const outlineCourseIdsBySkill = new Map<string, Set<string>>();
  const outlineChapterKeysBySkill = new Map<string, Set<string>>();
  const mappedCourseIds = new Set<string>();

  for (const mapping of persistedCourseMappings) {
    mappedCourseIds.add(mapping.courseId);
    const existing = persistedCourseIdsBySkill.get(mapping.skillKey) ?? new Set<string>();
    existing.add(mapping.courseId);
    persistedCourseIdsBySkill.set(mapping.skillKey, existing);
  }

  for (const mapping of persistedChapterMappings) {
    mappedCourseIds.add(mapping.courseId);
    const chapterKey = `${mapping.courseId}:chapter:${mapping.chapterIndex}`;
    const existing = persistedChapterKeysBySkill.get(mapping.skillKey) ?? new Set<string>();
    existing.add(chapterKey);
    persistedChapterKeysBySkill.set(mapping.skillKey, existing);
  }

  for (const course of coursesById.values()) {
    for (const skillId of course.explicitSkillIds) {
      const existing = outlineCourseIdsBySkill.get(skillId) ?? new Set<string>();
      existing.add(course.id);
      outlineCourseIdsBySkill.set(skillId, existing);
    }

    for (const chapter of course.chapters) {
      for (const skillId of chapter.explicitSkillIds) {
        const chapterKey = `${course.id}:chapter:${chapter.chapterIndex}`;
        const existing = outlineChapterKeysBySkill.get(skillId) ?? new Set<string>();
        existing.add(chapterKey);
        outlineChapterKeysBySkill.set(skillId, existing);
      }
    }
  }

  const rawSkillSnapshots = GOLDEN_PATH_SKILLS.map((skill) => {
    const skillAliases = [skill.name, ...skill.aliases];
    const explicitChapterKeys = [
      ...(persistedChapterKeysBySkill.get(skill.id) ?? new Set<string>()),
      ...(outlineChapterKeysBySkill.get(skill.id) ?? new Set<string>()),
    ];
    const explicitCourseIds = uniqueStrings([
      ...(persistedCourseIdsBySkill.get(skill.id) ?? new Set<string>()),
      ...(outlineCourseIdsBySkill.get(skill.id) ?? new Set<string>()),
      ...explicitChapterKeys.map((key) => key.split(":chapter:")[0] ?? ""),
    ]);
    const explicitCourses = explicitCourseIds
      .map((courseId) => coursesById.get(courseId))
      .filter((course): course is CourseArtifact => Boolean(course));
    const fallbackCourses = [...coursesById.values()].filter(
      (course) => !mappedCourseIds.has(course.id),
    );
    const fallbackMatchedCourses = fallbackCourses.filter(
      (course) => matchAliasesScore(course.searchText, skillAliases) > 0,
    );
    const matchedCourses = [
      ...new Map(
        [...explicitCourses, ...fallbackMatchedCourses].map((course) => [course.id, course]),
      ).values(),
    ];

    const fallbackMatchedChapters = fallbackMatchedCourses.flatMap((course) =>
      course.chapters.filter((chapter) => matchAliasesScore(chapter.searchText, skillAliases) > 0),
    );
    const explicitMatchedChapters = explicitChapterKeys
      .map((key) => chapterByKey.get(key)?.chapter)
      .filter((chapter): chapter is CourseChapterArtifact => Boolean(chapter));
    const matchedChapters = [
      ...new Map(
        [...explicitMatchedChapters, ...fallbackMatchedChapters].map((chapter) => [
          chapter.key,
          chapter,
        ]),
      ).values(),
    ];

    const explicitMatchedSections = explicitChapterKeys.flatMap((key) => {
      const chapterContext = chapterByKey.get(key);
      if (!chapterContext) {
        return [];
      }

      return (
        coursesById
          .get(chapterContext.courseId)
          ?.sections.filter(
            (section) => section.chapterIndex === chapterContext.chapter.chapterIndex,
          ) ?? []
      );
    });
    const fallbackMatchedSections = fallbackMatchedCourses.flatMap((course) =>
      course.sections.filter((section) => matchAliasesScore(section.searchText, skillAliases) > 0),
    );
    const matchedSections = [
      ...new Map(
        [...explicitMatchedSections, ...fallbackMatchedSections].map((section) => [
          section.key,
          section,
        ]),
      ).values(),
    ];

    const matchedChapterKeys = uniqueStrings([
      ...explicitChapterKeys,
      ...matchedChapters.map((chapter) => chapter.key),
    ]);
    const matchedCompletedSections = matchedSections.filter((section) => section.completed).length;
    const matchedStartedCourses = matchedCourses.filter(
      (course) => course.progressPercent > 0 || course.currentChapter > 0,
    ).length;

    const totalUnits =
      matchedSections.length > 0
        ? matchedSections.length
        : matchedChapters.length > 0
          ? matchedChapters.length
          : matchedCourses.length;

    const completedUnits =
      matchedSections.length > 0
        ? matchedCompletedSections
        : matchedChapters.length > 0
          ? matchedChapters.reduce(
              (sum, chapter) =>
                sum +
                (chapter.totalSections === 0
                  ? 0
                  : chapter.completedSections / chapter.totalSections),
              0,
            )
          : matchedCourses.reduce((sum, course) => sum + course.progressPercent / 100, 0);

    const completionRatio = totalUnits > 0 ? completedUnits / totalUnits : 0;

    const coverageScore = clampPercent(
      matchedCourses.length * 18 + matchedChapterKeys.length * 12 + matchedSections.length * 10,
    );

    const masteryScore = clampPercent(completionRatio * 100);
    const progressScore = clampPercent(coverageScore * 0.35 + masteryScore * 0.65);

    return {
      skill,
      coverageScore,
      masteryScore,
      progressScore,
      completionRatio,
      startedCourseCount: matchedStartedCourses,
      evidence: {
        masterySignals: matchedCompletedSections,
        courseCount: matchedCourses.length,
        chapterCount: matchedChapterKeys.length,
        highlightCount: 0,
        noteCount: 0,
      },
      linkedCourseIds: uniqueStrings(matchedCourses.map((course) => course.id)),
      linkedChapterKeys: uniqueStrings(matchedChapterKeys),
    };
  });

  const rawSkillMap = new Map(rawSkillSnapshots.map((snapshot) => [snapshot.skill.id, snapshot]));

  const skillSnapshots: GoldenPathNodeSnapshot[] = GOLDEN_PATH_SKILLS.map((skill) => {
    const rawSnapshot = rawSkillMap.get(skill.id);
    const prerequisitesMet =
      skill.prerequisites?.every((prerequisiteId) => {
        const prerequisite = rawSkillMap.get(prerequisiteId);
        return prerequisite
          ? prerequisite.progressScore >= 42 || prerequisite.masteryScore >= 48
          : false;
      }) ?? true;

    let state: GoldenPathNodeSnapshot["state"] = "locked";

    if ((rawSnapshot?.completionRatio ?? 0) >= 0.85 && (rawSnapshot?.coverageScore ?? 0) >= 25) {
      state = "mastered";
    } else if (
      (rawSnapshot?.startedCourseCount ?? 0) >= 1 ||
      (rawSnapshot?.progressScore ?? 0) >= 18
    ) {
      state = "in_progress";
    } else if (prerequisitesMet) {
      state = "ready";
    }

    return {
      ...skill,
      state,
      coverageScore: rawSnapshot?.coverageScore ?? 0,
      masteryScore: rawSnapshot?.masteryScore ?? 0,
      progressScore: rawSnapshot?.progressScore ?? 0,
      evidence: rawSnapshot?.evidence ?? {
        masterySignals: 0,
        courseCount: 0,
        chapterCount: 0,
        highlightCount: 0,
        noteCount: 0,
      },
      linkedCourseIds: rawSnapshot?.linkedCourseIds ?? [],
      linkedChapterKeys: rawSnapshot?.linkedChapterKeys ?? [],
    };
  });

  const skillSnapshotMap = new Map(skillSnapshots.map((snapshot) => [snapshot.id, snapshot]));

  const domainSnapshots = GOLDEN_PATH_DOMAINS.map<GoldenPathDomainSnapshot>((domain) => {
    const domainSkills = skillSnapshots.filter((skill) => skill.domainIds.includes(domain.id));
    const totalImportance = domainSkills.reduce((sum, skill) => sum + skill.importance, 0) || 1;
    const progress = clampPercent(
      domainSkills.reduce((sum, skill) => sum + skill.progressScore * skill.importance, 0) /
        totalImportance,
    );

    return {
      ...domain,
      progress,
      masteredCount: domainSkills.filter((skill) => skill.state === "mastered").length,
      inProgressCount: domainSkills.filter((skill) => skill.state === "in_progress").length,
      readyCount: domainSkills.filter((skill) => skill.state === "ready").length,
      lockedCount: domainSkills.filter((skill) => skill.state === "locked").length,
      nodes: domainSkills,
    };
  });

  const domainSnapshotMap = new Map(domainSnapshots.map((domain) => [domain.id, domain]));

  const routeSnapshots = GOLDEN_PATH_PROJECTION_PRIORS.map<GoldenPathRouteSnapshot>((prior) => {
    const projectionSkills = prior.skillIds
      .map((skillId) => skillSnapshotMap.get(skillId))
      .filter((value): value is GoldenPathNodeSnapshot => Boolean(value));

    const projectionDomains = prior.domainIds
      .map((domainId) => domainSnapshotMap.get(domainId))
      .filter((value): value is GoldenPathDomainSnapshot => Boolean(value));

    const skillWeight = projectionSkills.reduce((sum, skill) => sum + skill.importance, 0) || 1;
    const skillProgress = clampPercent(
      projectionSkills.reduce((sum, skill) => sum + skill.progressScore * skill.importance, 0) /
        skillWeight,
    );
    const domainProgress = clampPercent(
      projectionDomains.reduce((sum, domain) => sum + domain.progress, 0) /
        Math.max(1, projectionDomains.length),
    );

    const progress = clampPercent(skillProgress * 0.7 + domainProgress * 0.3);
    const fitScore = clampPercent(
      progress * 0.82 +
        projectionSkills.filter((skill) => skill.state === "in_progress").length * 4 +
        projectionSkills.filter((skill) => skill.state === "mastered").length * 3,
    );

    const nextActions = [...projectionSkills]
      .filter((skill) => skill.state !== "mastered")
      .sort((left, right) => {
        const leftWeight =
          (left.state === "in_progress" ? 30 : left.state === "ready" ? 20 : 0) +
          left.importance * 20 -
          left.progressScore;
        const rightWeight =
          (right.state === "in_progress" ? 30 : right.state === "ready" ? 20 : 0) +
          right.importance * 20 -
          right.progressScore;
        return rightWeight - leftWeight;
      })
      .slice(0, 4);

    const criticalGaps = [...projectionSkills]
      .filter((skill) => skill.state !== "mastered")
      .sort(
        (left, right) =>
          right.importance * (100 - right.progressScore) -
          left.importance * (100 - left.progressScore),
      )
      .slice(0, 4);

    const linkedLearning = [...coursesById.values()]
      .map<GoldenPathLinkedCourse | null>((course) => {
        const matchedSkills = projectionSkills.filter((skill) =>
          skill.linkedCourseIds.includes(course.id),
        );

        if (matchedSkills.length === 0) {
          return null;
        }

        const chapterKeys = uniqueStrings(
          matchedSkills.flatMap((skill) =>
            skill.linkedChapterKeys.filter((key) => key.startsWith(`${course.id}:chapter:`)),
          ),
        );

        const matchedChapters = course.chapters
          .filter((chapter) => chapterKeys.includes(chapter.key))
          .map((chapter) => ({
            key: chapter.key,
            title: chapter.title,
            chapterIndex: chapter.chapterIndex,
            completedSections: chapter.completedSections,
            totalSections: chapter.totalSections,
            matchedSkills: uniqueStrings(
              matchedSkills
                .filter((skill) => skill.linkedChapterKeys.includes(chapter.key))
                .map((skill) => skill.name),
            ),
          }))
          .slice(0, 3);

        return {
          courseId: course.id,
          title: course.title,
          progressPercent: course.progressPercent,
          matchedSkills: uniqueStrings(matchedSkills.map((skill) => skill.name)).slice(0, 4),
          matchedChapters,
          updatedAt: course.updatedAt,
        };
      })
      .filter((value): value is GoldenPathLinkedCourse => Boolean(value))
      .sort((left, right) => {
        const leftScore =
          left.matchedSkills.length * 20 + left.matchedChapters.length * 10 + left.progressPercent;
        const rightScore =
          right.matchedSkills.length * 20 +
          right.matchedChapters.length * 10 +
          right.progressPercent;
        return rightScore - leftScore;
      })
      .slice(0, 5);

    return {
      id: prior.id,
      name: prior.name,
      tagline: prior.tagline,
      description:
        prior.description ||
        createProjectionDescription(projectionDomains.map((domain) => domain.name)),
      outcomes: prior.outcomes,
      source: "projection",
      domainIds: prior.domainIds,
      progress,
      fitScore,
      masteredCount: projectionSkills.filter((skill) => skill.state === "mastered").length,
      inProgressCount: projectionSkills.filter((skill) => skill.state === "in_progress").length,
      readyCount: projectionSkills.filter((skill) => skill.state === "ready").length,
      lockedCount: projectionSkills.filter((skill) => skill.state === "locked").length,
      nextActions,
      criticalGaps,
      domains: projectionDomains,
      linkedLearning,
    };
  }).sort((left, right) => right.fitScore - left.fitScore);

  const recommendedRouteId = routeSnapshots[0]?.id ?? "current-focus";

  const futureRoutes: GoldenPathFutureRoute[] = routeSnapshots.slice(1).map((route) => ({
    id: route.id,
    name: route.name,
    fitScore: route.fitScore,
    progress: route.progress,
    missingSkills: route.criticalGaps.slice(0, 3).map((skill) => skill.name),
  }));

  return {
    coursesById,
    skillSnapshots,
    routeSnapshots,
    futureRoutes,
    recommendedRouteId,
  };
}

export async function getGoldenPathSnapshotCached(userId: string): Promise<GoldenPathSnapshot> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getGoldenPathTag(userId));

  const base = await loadGoldenPathBase(userId);
  const preference = await getUserGoldenPathPreference(userId);
  const routeIds = new Set(base.routeSnapshots.map((route) => route.id));
  const selectedRouteId =
    preference.currentRouteId && routeIds.has(preference.currentRouteId)
      ? preference.currentRouteId
      : null;
  const currentRouteId = selectedRouteId ?? base.recommendedRouteId;

  return {
    currentRouteId,
    recommendedRouteId: base.recommendedRouteId,
    selectedRouteId,
    routes: base.routeSnapshots,
    futureRoutes: base.futureRoutes,
    totals: {
      routeCount: base.routeSnapshots.length,
      activeCourseCount: base.coursesById.size,
      masteredCount: base.skillSnapshots.filter((skill) => skill.state === "mastered").length,
      inProgressCount: base.skillSnapshots.filter((skill) => skill.state === "in_progress").length,
      readyCount: base.skillSnapshots.filter((skill) => skill.state === "ready").length,
    },
  };
}

export async function getGoldenPathCourseContextCached(
  userId: string,
  courseId: string,
): Promise<GoldenPathCourseContext | null> {
  "use cache";

  cacheLife("minutes");
  cacheTag(getGoldenPathTag(userId));

  const base = await loadGoldenPathBase(userId);
  const course = base.coursesById.get(courseId);

  if (!course) {
    return null;
  }

  const mainRoute =
    base.routeSnapshots.find((route) => route.id === base.recommendedRouteId) ??
    base.routeSnapshots[0];

  if (!mainRoute) {
    return null;
  }

  const routeSkills = [
    ...new Map(
      mainRoute.domains.flatMap((domain) => domain.nodes).map((skill) => [skill.id, skill]),
    ).values(),
  ];
  const directCourseSkills = routeSkills.filter((skill) =>
    skill.linkedCourseIds.includes(course.id),
  );
  const fallbackCourseSkills = base.skillSnapshots.filter((skill) =>
    skill.linkedCourseIds.includes(course.id),
  );
  const relevantCourseSkills = (
    directCourseSkills.length > 0 ? directCourseSkills : fallbackCourseSkills
  )
    .slice()
    .sort(
      (left, right) =>
        right.progressScore - left.progressScore || right.importance - left.importance,
    );

  return {
    courseId: course.id,
    mainRouteId: mainRoute.id,
    mainRouteName: mainRoute.name,
    mainRouteTagline: mainRoute.tagline,
    courseSkills: relevantCourseSkills.slice(0, 8).map(toChapterSkill),
    chapters: course.chapters.map((chapter) => ({
      chapterIndex: chapter.chapterIndex,
      chapterTitle: chapter.title,
      matchedSkills: relevantCourseSkills
        .filter((skill) => skill.linkedChapterKeys.includes(chapter.key))
        .slice()
        .sort(
          (left, right) =>
            right.progressScore - left.progressScore || right.importance - left.importance,
        )
        .slice(0, 5)
        .map(toChapterSkill),
    })),
  };
}

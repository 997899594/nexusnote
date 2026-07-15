import { relations } from "drizzle-orm";
import { aiUsage } from "./schema/ai-usage";
import { accounts, sessions, userProfiles, users, verificationTokens } from "./schema/auth";
import {
  aiCapabilityUsageEvents,
  billingOrders,
  billingWebhookEvents,
  productAccessGrants,
  redeemCodeRedemptions,
  redeemCodes,
  userEntitlements,
} from "./schema/billing";
import { careerPlanningSessions, careerPlanRevisions } from "./schema/career-planning";
import {
  careerCourseChapterEvidence,
  careerCourseSkillEvidence,
  careerGenerationRuns,
  careerUserGraphState,
  careerUserSkillEdges,
  careerUserSkillNodeEvidence,
  careerUserSkillNodes,
  careerUserTreePreferences,
  careerUserTreeSnapshots,
} from "./schema/career-tree";
import { conversationMessages, conversations } from "./schema/conversations";
import {
  coursePublicAnnotations,
  coursePublicationLikes,
  coursePublicationSnapshots,
  coursePublicationSubscriptions,
  coursePublications,
  coursePublicationUrges,
} from "./schema/course-sharing";
import {
  courseOutlineNodes,
  courseOutlineVersions,
  courseSectionAnnotations,
  courseSections,
  courses,
} from "./schema/courses";
import {
  knowledgeEvidence,
  knowledgeEvidenceChunks,
  knowledgeEvidenceEventRefs,
  knowledgeEvidenceEvents,
  knowledgeEvidenceSourceLinks,
  knowledgeInsightEvidence,
  knowledgeInsights,
} from "./schema/knowledge";
import { knowledgeGenerationRuns } from "./schema/knowledge-runs";
import { learningEnrollments, learningSectionCompletions } from "./schema/learning";
import { learningActivationProjections, learningActivityEvents } from "./schema/learning-activity";
import { notes, noteTags, tags } from "./schema/notes";
import { researchRunSources, researchRuns, researchRunTasks } from "./schema/research";
import { aiSkins, userSkinPreferences } from "./schema/skins";

export * from "./schema/ai-usage";
export * from "./schema/auth";
export * from "./schema/billing";
export * from "./schema/career-planning";
export * from "./schema/career-tree";
export * from "./schema/conversations";
export * from "./schema/course-sharing";
export * from "./schema/courses";
export * from "./schema/knowledge";
export * from "./schema/knowledge-runs";
export * from "./schema/learning";
export * from "./schema/learning-activity";
export * from "./schema/notes";
export * from "./schema/research";
export * from "./schema/shared";
export * from "./schema/skins";

export const usersRelations = relations(users, ({ many }) => ({
  courses: many(courses),
  courseOutlineVersions: many(courseOutlineVersions),
  courseOutlineNodes: many(courseOutlineNodes),
  notes: many(notes),
  conversations: many(conversations),
  knowledgeEvidence: many(knowledgeEvidence),
  knowledgeEvidenceEvents: many(knowledgeEvidenceEvents),
  learningActivityEvents: many(learningActivityEvents),
  learningActivationProjections: many(learningActivationProjections),
  learningEnrollments: many(learningEnrollments),
  knowledgeInsights: many(knowledgeInsights),
  userProfiles: many(userProfiles),
  createdSkins: many(aiSkins),
  skinPreference: many(userSkinPreferences),
  courseSectionAnnotations: many(courseSectionAnnotations),
  noteTags: many(noteTags),
  knowledgeGenerationRuns: many(knowledgeGenerationRuns),
  careerGenerationRuns: many(careerGenerationRuns),
  careerCourseSkillEvidence: many(careerCourseSkillEvidence),
  careerCourseChapterEvidence: many(careerCourseChapterEvidence),
  careerUserSkillNodes: many(careerUserSkillNodes),
  careerUserSkillEdges: many(careerUserSkillEdges),
  careerUserSkillNodeEvidence: many(careerUserSkillNodeEvidence),
  careerUserTreePreferences: many(careerUserTreePreferences),
  careerUserTreeSnapshots: many(careerUserTreeSnapshots),
  careerUserGraphState: many(careerUserGraphState),
  careerPlanningSessions: many(careerPlanningSessions),
  careerPlanRevisions: many(careerPlanRevisions),
  ownedCoursePublications: many(coursePublications),
  coursePublicAnnotations: many(coursePublicAnnotations),
  coursePublicationSubscriptions: many(coursePublicationSubscriptions),
  coursePublicationLikes: many(coursePublicationLikes),
  coursePublicationUrges: many(coursePublicationUrges),
  researchRuns: many(researchRuns),
  billingOrders: many(billingOrders),
  entitlements: many(userEntitlements),
  redeemCodeRedemptions: many(redeemCodeRedemptions),
  aiCapabilityUsageEvents: many(aiCapabilityUsageEvents),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  tags: many(noteTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  noteTags: many(noteTags),
}));

export const noteTagsRelations = relations(noteTags, ({ one }) => ({
  note: one(notes, {
    fields: [noteTags.noteId],
    references: [notes.id],
  }),
  tag: one(tags, {
    fields: [noteTags.tagId],
    references: [tags.id],
  }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  user: one(users, {
    fields: [conversations.userId],
    references: [users.id],
  }),
  learnCourse: one(courses, {
    fields: [conversations.learnCourseId],
    references: [courses.id],
  }),
  messages: many(conversationMessages),
  researchRuns: many(researchRuns),
  careerPlanningSessions: many(careerPlanningSessions),
}));

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationMessages.conversationId],
    references: [conversations.id],
  }),
}));

export const knowledgeEvidenceChunksRelations = relations(knowledgeEvidenceChunks, ({ one }) => ({
  evidence: one(knowledgeEvidence, {
    fields: [knowledgeEvidenceChunks.knowledgeEvidenceId],
    references: [knowledgeEvidence.id],
  }),
}));

export const knowledgeEvidenceRelations = relations(knowledgeEvidence, ({ one, many }) => ({
  user: one(users, {
    fields: [knowledgeEvidence.userId],
    references: [users.id],
  }),
  chunks: many(knowledgeEvidenceChunks),
  sourceLinks: many(knowledgeEvidenceSourceLinks),
  insightLinks: many(knowledgeInsightEvidence),
}));

export const knowledgeEvidenceEventsRelations = relations(
  knowledgeEvidenceEvents,
  ({ one, many }) => ({
    user: one(users, {
      fields: [knowledgeEvidenceEvents.userId],
      references: [users.id],
    }),
    refs: many(knowledgeEvidenceEventRefs),
  }),
);

export const knowledgeEvidenceSourceLinksRelations = relations(
  knowledgeEvidenceSourceLinks,
  ({ one }) => ({
    evidence: one(knowledgeEvidence, {
      fields: [knowledgeEvidenceSourceLinks.evidenceId],
      references: [knowledgeEvidence.id],
    }),
  }),
);

export const knowledgeInsightsRelations = relations(knowledgeInsights, ({ one, many }) => ({
  user: one(users, {
    fields: [knowledgeInsights.userId],
    references: [users.id],
  }),
  evidenceLinks: many(knowledgeInsightEvidence),
}));

export const knowledgeInsightEvidenceRelations = relations(knowledgeInsightEvidence, ({ one }) => ({
  insight: one(knowledgeInsights, {
    fields: [knowledgeInsightEvidence.insightId],
    references: [knowledgeInsights.id],
  }),
  evidence: one(knowledgeEvidence, {
    fields: [knowledgeInsightEvidence.evidenceId],
    references: [knowledgeEvidence.id],
  }),
}));

export const knowledgeEvidenceEventRefsRelations = relations(
  knowledgeEvidenceEventRefs,
  ({ one }) => ({
    event: one(knowledgeEvidenceEvents, {
      fields: [knowledgeEvidenceEventRefs.eventId],
      references: [knowledgeEvidenceEvents.id],
    }),
  }),
);

export const coursesRelations = relations(courses, ({ one, many }) => ({
  user: one(users, {
    fields: [courses.userId],
    references: [users.id],
  }),
  outlineVersions: many(courseOutlineVersions),
  outlineNodes: many(courseOutlineNodes),
  sections: many(courseSections),
  learningActivityEvents: many(learningActivityEvents),
  learningActivationProjections: many(learningActivationProjections),
  publications: many(coursePublications),
}));

export const learningActivityEventsRelations = relations(learningActivityEvents, ({ one }) => ({
  user: one(users, {
    fields: [learningActivityEvents.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [learningActivityEvents.courseId],
    references: [courses.id],
  }),
  enrollment: one(learningEnrollments, {
    fields: [learningActivityEvents.enrollmentId],
    references: [learningEnrollments.id],
  }),
}));

export const learningActivationProjectionsRelations = relations(
  learningActivationProjections,
  ({ one }) => ({
    user: one(users, {
      fields: [learningActivationProjections.userId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [learningActivationProjections.courseId],
      references: [courses.id],
    }),
  }),
);

export const learningEnrollmentsRelations = relations(learningEnrollments, ({ one, many }) => ({
  user: one(users, {
    fields: [learningEnrollments.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [learningEnrollments.courseId],
    references: [courses.id],
  }),
  outlineVersion: one(courseOutlineVersions, {
    fields: [learningEnrollments.outlineVersionId],
    references: [courseOutlineVersions.id],
  }),
  publication: one(coursePublications, {
    fields: [learningEnrollments.publicationId],
    references: [coursePublications.id],
  }),
  snapshot: one(coursePublicationSnapshots, {
    fields: [learningEnrollments.snapshotId],
    references: [coursePublicationSnapshots.id],
  }),
  completions: many(learningSectionCompletions),
}));

export const learningSectionCompletionsRelations = relations(
  learningSectionCompletions,
  ({ one }) => ({
    enrollment: one(learningEnrollments, {
      fields: [learningSectionCompletions.enrollmentId],
      references: [learningEnrollments.id],
    }),
  }),
);

export const courseOutlineVersionsRelations = relations(courseOutlineVersions, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseOutlineVersions.courseId],
    references: [courses.id],
  }),
  nodes: many(courseOutlineNodes),
}));

export const courseOutlineNodesRelations = relations(courseOutlineNodes, ({ one }) => ({
  course: one(courses, {
    fields: [courseOutlineNodes.courseId],
    references: [courses.id],
  }),
  outlineVersion: one(courseOutlineVersions, {
    fields: [courseOutlineNodes.outlineVersionId],
    references: [courseOutlineVersions.id],
  }),
}));

export const courseSectionsRelations = relations(courseSections, ({ one, many }) => ({
  course: one(courses, {
    fields: [courseSections.courseId],
    references: [courses.id],
  }),
  outlineVersion: one(courseOutlineVersions, {
    fields: [courseSections.outlineVersionId],
    references: [courseOutlineVersions.id],
  }),
  outlineNode: one(courseOutlineNodes, {
    fields: [courseSections.outlineNodeId],
    references: [courseOutlineNodes.id],
  }),
  annotations: many(courseSectionAnnotations),
}));

export const courseSectionAnnotationsRelations = relations(courseSectionAnnotations, ({ one }) => ({
  courseSection: one(courseSections, {
    fields: [courseSectionAnnotations.courseSectionId],
    references: [courseSections.id],
  }),
  user: one(users, {
    fields: [courseSectionAnnotations.userId],
    references: [users.id],
  }),
}));

export const coursePublicationsRelations = relations(coursePublications, ({ one, many }) => ({
  sourceCourse: one(courses, {
    fields: [coursePublications.sourceCourseId],
    references: [courses.id],
  }),
  owner: one(users, {
    fields: [coursePublications.ownerUserId],
    references: [users.id],
  }),
  currentSnapshot: one(coursePublicationSnapshots, {
    fields: [coursePublications.currentSnapshotId],
    references: [coursePublicationSnapshots.id],
  }),
  snapshots: many(coursePublicationSnapshots),
  annotations: many(coursePublicAnnotations),
  subscriptions: many(coursePublicationSubscriptions),
  likes: many(coursePublicationLikes),
  urges: many(coursePublicationUrges),
}));

export const coursePublicationSnapshotsRelations = relations(
  coursePublicationSnapshots,
  ({ one, many }) => ({
    publication: one(coursePublications, {
      fields: [coursePublicationSnapshots.publicationId],
      references: [coursePublications.id],
    }),
    sourceCourse: one(courses, {
      fields: [coursePublicationSnapshots.sourceCourseId],
      references: [courses.id],
    }),
    sourceOutlineVersion: one(courseOutlineVersions, {
      fields: [coursePublicationSnapshots.sourceOutlineVersionId],
      references: [courseOutlineVersions.id],
    }),
    annotations: many(coursePublicAnnotations),
    subscriptions: many(coursePublicationSubscriptions),
  }),
);

export const coursePublicAnnotationsRelations = relations(coursePublicAnnotations, ({ one }) => ({
  publication: one(coursePublications, {
    fields: [coursePublicAnnotations.publicationId],
    references: [coursePublications.id],
  }),
  snapshot: one(coursePublicationSnapshots, {
    fields: [coursePublicAnnotations.snapshotId],
    references: [coursePublicationSnapshots.id],
  }),
  user: one(users, {
    fields: [coursePublicAnnotations.userId],
    references: [users.id],
  }),
}));

export const coursePublicationSubscriptionsRelations = relations(
  coursePublicationSubscriptions,
  ({ one }) => ({
    publication: one(coursePublications, {
      fields: [coursePublicationSubscriptions.publicationId],
      references: [coursePublications.id],
    }),
    user: one(users, {
      fields: [coursePublicationSubscriptions.userId],
      references: [users.id],
    }),
    lastSeenSnapshot: one(coursePublicationSnapshots, {
      fields: [coursePublicationSubscriptions.lastSeenSnapshotId],
      references: [coursePublicationSnapshots.id],
    }),
  }),
);

export const coursePublicationLikesRelations = relations(coursePublicationLikes, ({ one }) => ({
  publication: one(coursePublications, {
    fields: [coursePublicationLikes.publicationId],
    references: [coursePublications.id],
  }),
  user: one(users, {
    fields: [coursePublicationLikes.userId],
    references: [users.id],
  }),
}));

export const coursePublicationUrgesRelations = relations(coursePublicationUrges, ({ one }) => ({
  publication: one(coursePublications, {
    fields: [coursePublicationUrges.publicationId],
    references: [coursePublications.id],
  }),
  user: one(users, {
    fields: [coursePublicationUrges.userId],
    references: [users.id],
  }),
}));

export const aiSkinsRelations = relations(aiSkins, ({ one, many }) => ({
  author: one(users, {
    fields: [aiSkins.authorId],
    references: [users.id],
  }),
  userPreferences: many(userSkinPreferences),
}));

export const userSkinPreferencesRelations = relations(userSkinPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userSkinPreferences.userId],
    references: [users.id],
  }),
}));

export const knowledgeGenerationRunsRelations = relations(knowledgeGenerationRuns, ({ one }) => ({
  user: one(users, {
    fields: [knowledgeGenerationRuns.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [knowledgeGenerationRuns.courseId],
    references: [courses.id],
  }),
}));

export const researchRunsRelations = relations(researchRuns, ({ one, many }) => ({
  user: one(users, {
    fields: [researchRuns.userId],
    references: [users.id],
  }),
  session: one(conversations, {
    fields: [researchRuns.sessionId],
    references: [conversations.id],
  }),
  tasks: many(researchRunTasks),
  sources: many(researchRunSources),
}));

export const researchRunTasksRelations = relations(researchRunTasks, ({ one, many }) => ({
  run: one(researchRuns, {
    fields: [researchRunTasks.runId],
    references: [researchRuns.id],
  }),
  sources: many(researchRunSources),
}));

export const researchRunSourcesRelations = relations(researchRunSources, ({ one }) => ({
  run: one(researchRuns, {
    fields: [researchRunSources.runId],
    references: [researchRuns.id],
  }),
  task: one(researchRunTasks, {
    fields: [researchRunSources.taskId],
    references: [researchRunTasks.id],
  }),
}));

export const careerPlanningSessionsRelations = relations(
  careerPlanningSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [careerPlanningSessions.userId],
      references: [users.id],
    }),
    conversation: one(conversations, {
      fields: [careerPlanningSessions.conversationId],
      references: [conversations.id],
    }),
    revisions: many(careerPlanRevisions),
  }),
);

export const careerPlanRevisionsRelations = relations(careerPlanRevisions, ({ one }) => ({
  session: one(careerPlanningSessions, {
    fields: [careerPlanRevisions.sessionId],
    references: [careerPlanningSessions.id],
  }),
  user: one(users, {
    fields: [careerPlanRevisions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const verificationTokensRelations = relations(verificationTokens, () => ({}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, {
    fields: [userProfiles.userId],
    references: [users.id],
  }),
}));

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  user: one(users, {
    fields: [aiUsage.userId],
    references: [users.id],
  }),
}));

export const billingOrdersRelations = relations(billingOrders, ({ one }) => ({
  user: one(users, {
    fields: [billingOrders.userId],
    references: [users.id],
  }),
}));

export const userEntitlementsRelations = relations(userEntitlements, ({ one }) => ({
  user: one(users, {
    fields: [userEntitlements.userId],
    references: [users.id],
  }),
}));

export const aiCapabilityUsageEventsRelations = relations(aiCapabilityUsageEvents, ({ one }) => ({
  user: one(users, {
    fields: [aiCapabilityUsageEvents.userId],
    references: [users.id],
  }),
}));

export const productAccessGrantsRelations = relations(productAccessGrants, () => ({}));

export const billingWebhookEventsRelations = relations(billingWebhookEvents, () => ({}));

export const redeemCodesRelations = relations(redeemCodes, ({ many }) => ({
  redemptions: many(redeemCodeRedemptions),
}));

export const redeemCodeRedemptionsRelations = relations(redeemCodeRedemptions, ({ one }) => ({
  code: one(redeemCodes, {
    fields: [redeemCodeRedemptions.codeId],
    references: [redeemCodes.id],
  }),
  user: one(users, {
    fields: [redeemCodeRedemptions.userId],
    references: [users.id],
  }),
  entitlement: one(userEntitlements, {
    fields: [redeemCodeRedemptions.entitlementId],
    references: [userEntitlements.id],
  }),
}));

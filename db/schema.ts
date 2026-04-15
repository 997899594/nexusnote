import { relations } from "drizzle-orm";
import { aiUsage } from "./schema/ai-usage";
import {
  accounts,
  sessions,
  stylePrivacySettings,
  userProfiles,
  users,
  verificationTokens,
} from "./schema/auth";
import { conversationMessages, conversations } from "./schema/conversations";
import {
  courseOutlineNodes,
  courseOutlineVersions,
  courseProgress,
  courseSectionAnnotations,
  courseSections,
  courses,
} from "./schema/courses";
import {
  knowledgeGenerationRuns,
  userCareerTreePreferences,
  userCareerTreeSnapshots,
  userFocusSnapshots,
  userGrowthState,
  userProfileSnapshots,
  userSkillEdges,
  userSkillNodeEvidence,
  userSkillNodes,
} from "./schema/growth";
import {
  knowledgeEvidence,
  knowledgeEvidenceChunks,
  knowledgeEvidenceEventRefs,
  knowledgeEvidenceEvents,
  knowledgeEvidenceSourceLinks,
  knowledgeInsightEvidence,
  knowledgeInsights,
} from "./schema/knowledge";
import { noteSnapshots, notes, noteTags, tags } from "./schema/notes";
import { aiSkins, userSkinPreferences } from "./schema/skins";

export * from "./schema/ai-usage";
export * from "./schema/auth";
export * from "./schema/conversations";
export * from "./schema/courses";
export * from "./schema/growth";
export * from "./schema/knowledge";
export * from "./schema/notes";
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
  knowledgeInsights: many(knowledgeInsights),
  userProfiles: many(userProfiles),
  stylePrivacySettings: many(stylePrivacySettings),
  createdSkins: many(aiSkins),
  skinPreference: many(userSkinPreferences),
  courseProgress: many(courseProgress),
  courseSectionAnnotations: many(courseSectionAnnotations),
  noteTags: many(noteTags),
  knowledgeGenerationRuns: many(knowledgeGenerationRuns),
  userSkillNodes: many(userSkillNodes),
  userSkillEdges: many(userSkillEdges),
  userSkillNodeEvidence: many(userSkillNodeEvidence),
  userCareerTreePreferences: many(userCareerTreePreferences),
  userCareerTreeSnapshots: many(userCareerTreeSnapshots),
  userGrowthState: many(userGrowthState),
  userFocusSnapshots: many(userFocusSnapshots),
  userProfileSnapshots: many(userProfileSnapshots),
}));

export const notesRelations = relations(notes, ({ one, many }) => ({
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  snapshots: many(noteSnapshots),
  tags: many(noteTags),
}));

export const noteSnapshotsRelations = relations(noteSnapshots, ({ one }) => ({
  note: one(notes, {
    fields: [noteSnapshots.noteId],
    references: [notes.id],
  }),
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
  progress: many(courseProgress),
}));

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
  annotations: many(courseSectionAnnotations),
}));

export const courseProgressRelations = relations(courseProgress, ({ one }) => ({
  course: one(courses, {
    fields: [courseProgress.courseId],
    references: [courses.id],
  }),
  user: one(users, {
    fields: [courseProgress.userId],
    references: [users.id],
  }),
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

export const stylePrivacySettingsRelations = relations(stylePrivacySettings, ({ one }) => ({
  user: one(users, {
    fields: [stylePrivacySettings.userId],
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

export const userSkillNodesRelations = relations(userSkillNodes, ({ one, many }) => ({
  user: one(users, {
    fields: [userSkillNodes.userId],
    references: [users.id],
  }),
  outgoingEdges: many(userSkillEdges, {
    relationName: "userSkillEdgesFrom",
  }),
  incomingEdges: many(userSkillEdges, {
    relationName: "userSkillEdgesTo",
  }),
  evidenceLinks: many(userSkillNodeEvidence),
}));

export const userSkillEdgesRelations = relations(userSkillEdges, ({ one }) => ({
  user: one(users, {
    fields: [userSkillEdges.userId],
    references: [users.id],
  }),
  fromNode: one(userSkillNodes, {
    fields: [userSkillEdges.fromNodeId],
    references: [userSkillNodes.id],
    relationName: "userSkillEdgesFrom",
  }),
  toNode: one(userSkillNodes, {
    fields: [userSkillEdges.toNodeId],
    references: [userSkillNodes.id],
    relationName: "userSkillEdgesTo",
  }),
}));

export const userSkillNodeEvidenceRelations = relations(userSkillNodeEvidence, ({ one }) => ({
  user: one(users, {
    fields: [userSkillNodeEvidence.userId],
    references: [users.id],
  }),
  node: one(userSkillNodes, {
    fields: [userSkillNodeEvidence.nodeId],
    references: [userSkillNodes.id],
  }),
  knowledgeEvidence: one(knowledgeEvidence, {
    fields: [userSkillNodeEvidence.knowledgeEvidenceId],
    references: [knowledgeEvidence.id],
  }),
}));

export const userCareerTreePreferencesRelations = relations(
  userCareerTreePreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userCareerTreePreferences.userId],
      references: [users.id],
    }),
  }),
);

export const userCareerTreeSnapshotsRelations = relations(userCareerTreeSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [userCareerTreeSnapshots.userId],
    references: [users.id],
  }),
  composeRun: one(knowledgeGenerationRuns, {
    fields: [userCareerTreeSnapshots.composeRunId],
    references: [knowledgeGenerationRuns.id],
  }),
}));

export const userFocusSnapshotsRelations = relations(userFocusSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [userFocusSnapshots.userId],
    references: [users.id],
  }),
  treeSnapshot: one(userCareerTreeSnapshots, {
    fields: [userFocusSnapshots.treeSnapshotId],
    references: [userCareerTreeSnapshots.id],
  }),
}));

export const userProfileSnapshotsRelations = relations(userProfileSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [userProfileSnapshots.userId],
    references: [users.id],
  }),
  treeSnapshot: one(userCareerTreeSnapshots, {
    fields: [userProfileSnapshots.treeSnapshotId],
    references: [userCareerTreeSnapshots.id],
  }),
  focusSnapshot: one(userFocusSnapshots, {
    fields: [userProfileSnapshots.focusSnapshotId],
    references: [userFocusSnapshots.id],
  }),
}));

export const userGrowthStateRelations = relations(userGrowthState, ({ one }) => ({
  user: one(users, {
    fields: [userGrowthState.userId],
    references: [users.id],
  }),
  lastMergeRun: one(knowledgeGenerationRuns, {
    fields: [userGrowthState.lastMergeRunId],
    references: [knowledgeGenerationRuns.id],
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

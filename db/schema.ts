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
import {
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
  courseProgress,
  courseSectionAnnotations,
  courseSections,
  courses,
} from "./schema/courses";
import {
  knowledgeChunks,
  knowledgeEvidence,
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
export * from "./schema/career-tree";
export * from "./schema/conversations";
export * from "./schema/courses";
export * from "./schema/knowledge";
export * from "./schema/notes";
export * from "./schema/shared";
export * from "./schema/skins";

export const usersRelations = relations(users, ({ many }) => ({
  courses: many(courses),
  notes: many(notes),
  conversations: many(conversations),
  knowledgeEvidence: many(knowledgeEvidence),
  knowledgeChunks: many(knowledgeChunks),
  knowledgeEvidenceEvents: many(knowledgeEvidenceEvents),
  knowledgeInsights: many(knowledgeInsights),
  userProfiles: many(userProfiles),
  stylePrivacySettings: many(stylePrivacySettings),
  createdSkins: many(aiSkins),
  skinPreference: many(userSkinPreferences),
  courseProgress: many(courseProgress),
  courseSectionAnnotations: many(courseSectionAnnotations),
  noteTags: many(noteTags),
  careerGenerationRuns: many(careerGenerationRuns),
  careerUserSkillNodes: many(careerUserSkillNodes),
  careerUserSkillEdges: many(careerUserSkillEdges),
  careerUserSkillNodeEvidence: many(careerUserSkillNodeEvidence),
  careerUserTreePreferences: many(careerUserTreePreferences),
  careerUserTreeSnapshots: many(careerUserTreeSnapshots),
  careerUserGraphState: many(careerUserGraphState),
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

export const knowledgeChunksRelations = relations(knowledgeChunks, ({ one }) => ({
  user: one(users, {
    fields: [knowledgeChunks.userId],
    references: [users.id],
  }),
}));

export const knowledgeEvidenceRelations = relations(knowledgeEvidence, ({ one, many }) => ({
  user: one(users, {
    fields: [knowledgeEvidence.userId],
    references: [users.id],
  }),
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
  sections: many(courseSections),
  progress: many(courseProgress),
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

export const careerGenerationRunsRelations = relations(careerGenerationRuns, ({ one }) => ({
  user: one(users, {
    fields: [careerGenerationRuns.userId],
    references: [users.id],
  }),
  course: one(courses, {
    fields: [careerGenerationRuns.courseId],
    references: [courses.id],
  }),
}));

export const careerUserSkillNodesRelations = relations(careerUserSkillNodes, ({ one, many }) => ({
  user: one(users, {
    fields: [careerUserSkillNodes.userId],
    references: [users.id],
  }),
  outgoingEdges: many(careerUserSkillEdges, {
    relationName: "careerUserSkillEdgesFrom",
  }),
  incomingEdges: many(careerUserSkillEdges, {
    relationName: "careerUserSkillEdgesTo",
  }),
  evidenceLinks: many(careerUserSkillNodeEvidence),
}));

export const careerUserSkillEdgesRelations = relations(careerUserSkillEdges, ({ one }) => ({
  user: one(users, {
    fields: [careerUserSkillEdges.userId],
    references: [users.id],
  }),
  fromNode: one(careerUserSkillNodes, {
    fields: [careerUserSkillEdges.fromNodeId],
    references: [careerUserSkillNodes.id],
    relationName: "careerUserSkillEdgesFrom",
  }),
  toNode: one(careerUserSkillNodes, {
    fields: [careerUserSkillEdges.toNodeId],
    references: [careerUserSkillNodes.id],
    relationName: "careerUserSkillEdgesTo",
  }),
}));

export const careerUserSkillNodeEvidenceRelations = relations(
  careerUserSkillNodeEvidence,
  ({ one }) => ({
    user: one(users, {
      fields: [careerUserSkillNodeEvidence.userId],
      references: [users.id],
    }),
    node: one(careerUserSkillNodes, {
      fields: [careerUserSkillNodeEvidence.nodeId],
      references: [careerUserSkillNodes.id],
    }),
    knowledgeEvidence: one(knowledgeEvidence, {
      fields: [careerUserSkillNodeEvidence.knowledgeEvidenceId],
      references: [knowledgeEvidence.id],
    }),
  }),
);

export const careerUserTreePreferencesRelations = relations(
  careerUserTreePreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [careerUserTreePreferences.userId],
      references: [users.id],
    }),
  }),
);

export const careerUserTreeSnapshotsRelations = relations(careerUserTreeSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [careerUserTreeSnapshots.userId],
    references: [users.id],
  }),
  composeRun: one(careerGenerationRuns, {
    fields: [careerUserTreeSnapshots.composeRunId],
    references: [careerGenerationRuns.id],
  }),
}));

export const careerUserGraphStateRelations = relations(careerUserGraphState, ({ one }) => ({
  user: one(users, {
    fields: [careerUserGraphState.userId],
    references: [users.id],
  }),
  lastMergeRun: one(careerGenerationRuns, {
    fields: [careerUserGraphState.lastMergeRunId],
    references: [careerGenerationRuns.id],
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

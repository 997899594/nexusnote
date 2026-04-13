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
  courseChapterSkillMappings,
  courseProgress,
  courseSectionAnnotations,
  courseSections,
  courseSkillMappings,
  courses,
} from "./schema/courses";
import { knowledgeChunks } from "./schema/knowledge";
import { noteSnapshots, notes, noteTags, tags } from "./schema/notes";
import { skillRelationships, skills, userSkillMastery } from "./schema/skills";
import { aiSkins, userSkinPreferences } from "./schema/skins";

export * from "./schema/ai-usage";
export * from "./schema/auth";
export * from "./schema/career-tree";
export * from "./schema/conversations";
export * from "./schema/courses";
export * from "./schema/knowledge";
export * from "./schema/notes";
export * from "./schema/shared";
export * from "./schema/skills";
export * from "./schema/skins";

export const usersRelations = relations(users, ({ many }) => ({
  courses: many(courses),
  notes: many(notes),
  conversations: many(conversations),
  knowledgeChunks: many(knowledgeChunks),
  userProfiles: many(userProfiles),
  stylePrivacySettings: many(stylePrivacySettings),
  createdSkins: many(aiSkins),
  skinPreference: many(userSkinPreferences),
  courseProgress: many(courseProgress),
  courseSectionAnnotations: many(courseSectionAnnotations),
  noteTags: many(noteTags),
  careerGenerationRuns: many(careerGenerationRuns),
  careerCourseSkillEvidence: many(careerCourseSkillEvidence),
  careerCourseChapterEvidence: many(careerCourseChapterEvidence),
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

export const coursesRelations = relations(courses, ({ one, many }) => ({
  user: one(users, {
    fields: [courses.userId],
    references: [users.id],
  }),
  sections: many(courseSections),
  progress: many(courseProgress),
  skillMappings: many(courseSkillMappings),
  chapterSkillMappings: many(courseChapterSkillMappings),
  careerCourseSkillEvidence: many(careerCourseSkillEvidence),
  careerCourseChapterEvidence: many(careerCourseChapterEvidence),
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

export const courseSkillMappingsRelations = relations(courseSkillMappings, ({ one }) => ({
  course: one(courses, {
    fields: [courseSkillMappings.courseId],
    references: [courses.id],
  }),
}));

export const courseChapterSkillMappingsRelations = relations(
  courseChapterSkillMappings,
  ({ one }) => ({
    course: one(courses, {
      fields: [courseChapterSkillMappings.courseId],
      references: [courses.id],
    }),
  }),
);

export const stylePrivacySettingsRelations = relations(stylePrivacySettings, ({ one }) => ({
  user: one(users, {
    fields: [stylePrivacySettings.userId],
    references: [users.id],
  }),
}));

export const skillsRelations = relations(skills, ({ many }) => ({
  sourceRelationships: many(skillRelationships, {
    relationName: "sourceRelationships",
  }),
  targetRelationships: many(skillRelationships, {
    relationName: "targetRelationships",
  }),
  userMastery: many(userSkillMastery),
}));

export const skillRelationshipsRelations = relations(skillRelationships, ({ one }) => ({
  sourceSkill: one(skills, {
    fields: [skillRelationships.sourceSkillId],
    references: [skills.id],
    relationName: "sourceRelationships",
  }),
  targetSkill: one(skills, {
    fields: [skillRelationships.targetSkillId],
    references: [skills.id],
    relationName: "targetRelationships",
  }),
}));

export const userSkillMasteryRelations = relations(userSkillMastery, ({ one }) => ({
  user: one(users, {
    fields: [userSkillMastery.userId],
    references: [users.id],
  }),
  skill: one(skills, {
    fields: [userSkillMastery.skillId],
    references: [skills.id],
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

export const careerCourseSkillEvidenceRelations = relations(
  careerCourseSkillEvidence,
  ({ one }) => ({
    user: one(users, {
      fields: [careerCourseSkillEvidence.userId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [careerCourseSkillEvidence.courseId],
      references: [courses.id],
    }),
    extractRun: one(careerGenerationRuns, {
      fields: [careerCourseSkillEvidence.extractRunId],
      references: [careerGenerationRuns.id],
    }),
  }),
);

export const careerCourseChapterEvidenceRelations = relations(
  careerCourseChapterEvidence,
  ({ one }) => ({
    user: one(users, {
      fields: [careerCourseChapterEvidence.userId],
      references: [users.id],
    }),
    course: one(courses, {
      fields: [careerCourseChapterEvidence.courseId],
      references: [courses.id],
    }),
  }),
);

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
    courseSkillEvidence: one(careerCourseSkillEvidence, {
      fields: [careerUserSkillNodeEvidence.courseSkillEvidenceId],
      references: [careerCourseSkillEvidence.id],
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

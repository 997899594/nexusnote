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

import { and, courseProfiles, db, eq } from "@nexusnote/db";
import {
  EMPTY_PROFILE,
  type InterviewStatus,
  type LearnerProfile,
  LearnerProfileSchema,
} from "@/features/learning/types";

// ─── 创建 Session ───

export async function createInterviewSession(userId: string, initialGoal: string): Promise<string> {
  const profile: LearnerProfile = {
    ...EMPTY_PROFILE,
    goal: initialGoal,
    goalClarity: "vague",
    readiness: 5,
    missingInfo: ["领域和复杂度", "学习背景", "预期成果"],
  };

  const id = crypto.randomUUID();

  await db.insert(courseProfiles).values({
    id,
    userId,
    interviewProfile: profile as unknown as Record<string, unknown>,
    interviewMessages: [],
    interviewStatus: "interviewing",
  });

  return id;
}

// ─── 读取 Session ───

export async function getInterviewSession(sessionId: string, userId: string) {
  const session = await db.query.courseProfiles.findFirst({
    where: and(eq(courseProfiles.id, sessionId), eq(courseProfiles.userId, userId)),
  });
  if (!session) throw new Error("Interview session not found");
  return session;
}

// ─── 读取 Profile ───

export async function getProfile(sessionId: string): Promise<LearnerProfile> {
  const session = await db.query.courseProfiles.findFirst({
    where: eq(courseProfiles.id, sessionId),
    columns: { interviewProfile: true },
  });
  if (!session) throw new Error("Session not found");
  return LearnerProfileSchema.parse(session.interviewProfile || EMPTY_PROFILE);
}

// ─── Merge Profile（部分更新）───

export async function mergeProfile(
  sessionId: string,
  updates: Record<string, unknown>,
): Promise<LearnerProfile> {
  const current = await getProfile(sessionId);

  // insights 追加不覆盖
  const newInsights = updates.insights as string[] | undefined;
  const mergedInsights = newInsights ? [...current.insights, ...newInsights] : current.insights;

  // 其他字段：非 null 值覆盖
  const merged: LearnerProfile = { ...current };
  for (const [key, value] of Object.entries(updates)) {
    if (key === "insights") continue;
    if (value != null) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  merged.insights = mergedInsights;

  const validated = LearnerProfileSchema.parse(merged);

  await db
    .update(courseProfiles)
    .set({
      interviewProfile: validated as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(courseProfiles.id, sessionId));

  return validated;
}

// ─── 更新状态 ───

export async function updateInterviewStatus(sessionId: string, status: InterviewStatus) {
  await db
    .update(courseProfiles)
    .set({ interviewStatus: status, updatedAt: new Date() })
    .where(eq(courseProfiles.id, sessionId));
}

// ─── 保存 Messages ───

export async function saveInterviewMessages(sessionId: string, messages: unknown[]) {
  await db
    .update(courseProfiles)
    .set({ interviewMessages: messages, updatedAt: new Date() })
    .where(eq(courseProfiles.id, sessionId));
}

// ─── 确认大纲 ───

export async function confirmOutline(sessionId: string, outlineData: Record<string, unknown>) {
  const profile = await getProfile(sessionId);

  await db
    .update(courseProfiles)
    .set({
      title: (outlineData.title as string) || profile.goal || "",
      description: outlineData.description as string,
      difficulty: (outlineData.difficulty as string) || "intermediate",
      estimatedMinutes: (outlineData.estimatedMinutes as number) || 0,
      outlineData,
      interviewStatus: "confirmed",
      updatedAt: new Date(),
    })
    .where(eq(courseProfiles.id, sessionId));
}

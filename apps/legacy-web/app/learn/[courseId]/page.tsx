import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getCourseProfile } from "@/features/learning/agents/course-profile";
import { CourseSkeleton } from "@/features/shared/components/loading/skeletons";
import { type CourseProfileDTO, serializeObject } from "@/lib/actions/types";
import LearnPageClient from "./client-page";

interface LearnPageProps {
  params: Promise<{
    courseId: string;
  }>;
}

export default async function LearnPage({ params }: LearnPageProps) {
  const { courseId } = await params;
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Load course profile server-side to verify access and get data
  let profile: Awaited<ReturnType<typeof getCourseProfile>>;
  try {
    profile = await getCourseProfile(courseId);
  } catch (err) {
    console.error("[LearnPage] Failed to load course:", err);
    redirect("/create");
  }

  // Verify course belongs to current user
  if (profile.userId !== session.user?.id) {
    redirect("/create");
  }

  // 2026 架构师标准：使用序列化函数确保数据可传递到 Client Component
  // 移除手动映射，直接使用数据库返回的数据（已经是 JSON 可序列化）
  const courseProfileDTO: CourseProfileDTO = serializeObject({
    id: profile.id,
    title: profile.title ?? "",
    progress: {
      currentChapter: profile.currentChapter || 0,
      currentSection: profile.currentSection || 1,
    },
    userId: profile.userId || session.user.id,
    interviewProfile: profile.interviewProfile as
      | import("@/features/learning/types").LearnerProfile
      | null,
    outlineData: profile.outlineData,
  });

  return (
    <Suspense fallback={<CourseSkeleton />}>
      <LearnPageClient courseId={courseId} initialProfile={courseProfileDTO} />
    </Suspense>
  );
}

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCourseProfile } from "@/lib/ai/profile/course-profile";
import LearnPageClient from "./client-page";
import { CourseProfileDTO } from "@/lib/actions/types";

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
  let profile;
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

  // 架构师重构：手动映射数据库模型到 DTO，确保服务端组件与客户端组件契约一致
  const courseProfileDTO: CourseProfileDTO = {
    id: profile.id,
    title: profile.title,
    progress: {
      currentChapter: profile.currentChapter || 0,
      currentSection: profile.currentSection || 1,
    },
    userId: profile.userId || "",
    goal: profile.goal,
    background: profile.background,
    targetOutcome: profile.targetOutcome,
    cognitiveStyle: profile.cognitiveStyle,
    outlineData: profile.outlineData,
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LearnPageClient courseId={courseId} initialProfile={courseProfileDTO} />
    </Suspense>
  );
}

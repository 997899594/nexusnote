import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCourseProfile } from "@/lib/ai/profile/course-profile";
import LearnPageClient from "./client-page";

interface LearnPageProps {
  params: {
    courseId: string;
  };
}

export default async function LearnPage({ params }: LearnPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Load course profile server-side to verify access and get data
  let courseProfile;
  try {
    courseProfile = await getCourseProfile(params.courseId);
  } catch (err) {
    console.error("[LearnPage] Failed to load course:", err);
    redirect("/create");
  }

  // Verify course belongs to current user
  if (courseProfile.userId !== session.user?.id) {
    redirect("/create");
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LearnPageClient courseId={params.courseId} initialProfile={courseProfile} />
    </Suspense>
  );
}

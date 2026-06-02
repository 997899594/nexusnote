import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicCourseReader } from "@/components/course-reader/PublicCourseReader";
import { getDynamicPageSession } from "@/lib/auth/page";
import { getPublicCourseReaderData } from "@/lib/learning/course-sharing";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function PublicCoursePageContent({ params }: PageProps) {
  const { slug } = await params;
  const session = await getDynamicPageSession();
  const data = await getPublicCourseReaderData(slug, session?.user?.id ?? null);

  if (!data) {
    notFound();
  }

  return <PublicCourseReader data={data} />;
}

export default function PublicCoursePage({ params }: PageProps) {
  return (
    <Suspense fallback={<div className="ui-page-shell min-h-dvh" />}>
      <PublicCoursePageContent params={params} />
    </Suspense>
  );
}

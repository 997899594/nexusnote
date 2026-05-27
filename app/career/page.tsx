import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDynamicPageSession } from "@/lib/auth/page";
import { getCareerPlanningWorkspaceDataFresh } from "@/lib/career-planning/workspace-data";
import CareerPlanningClient from "./CareerPlanningClient";

async function CareerPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fcareer");
  }

  const data = await getCareerPlanningWorkspaceDataFresh(session.user.id);

  return <CareerPlanningClient data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <CareerPageContent />
    </Suspense>
  );
}

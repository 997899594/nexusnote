import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getDynamicPageSession } from "@/lib/auth/page";

async function CareerPageContent() {
  const session = await getDynamicPageSession();

  if (!session?.user) {
    redirect("/login?callbackUrl=%2Fcareer");
  }

  redirect("/career-trees?mentor=planning");

  return null;
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-bg)]" />}>
      <CareerPageContent />
    </Suspense>
  );
}

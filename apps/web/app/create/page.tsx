import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CreatePageClient from "./client-page";
import Loading from "./loading";

export default async function CreatePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<Loading />}>
      <CreatePageClient />
    </Suspense>
  );
}

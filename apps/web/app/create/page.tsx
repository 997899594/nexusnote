import { auth, type AuthSession } from "@/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import CreatePageClient from "./client-page";
import { CreatePageSkeleton } from "@/components/loading/skeletons";

export default async function CreatePage() {
  const session = await auth() as AuthSession | null;

  if (!session?.user?.id) {
    redirect("/login");
  }

  // 2026 架构师标准：确保传递到 Client Component 的数据可序列化
  // 使用 String() 确保原始类型，避免原型链问题
  const userId = String(session.user.id);

  return (
    <Suspense fallback={<CreatePageSkeleton />}>
      <CreatePageClient userId={userId} />
    </Suspense>
  );
}

/**
 * Auth Sync - 同步 NextAuth Session 到 Zustand Store
 *
 * 在需要访问用户状态的组件中使用
 */

"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useAuthStore } from "@/ui/auth";

export function AuthSync() {
  const { data: session, status } = useSession();
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);

  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }

    if (session?.user) {
      const user = session.user as any;
      setUser({
        id: user.id || "",
        email: session.user.email || "",
        name: session.user.name || "",
        image: session.user.image || undefined,
      });
    } else {
      setUser(null);
    }
  }, [session, status, setUser, setLoading]);

  return null;
}

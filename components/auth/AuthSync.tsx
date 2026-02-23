/**
 * Auth Sync - 同步 Auth.js v5 Session 到 Zustand Store
 *
 * v5 变化：
 * - useSession 从 next-auth/react 迁移到 auth-js/react
 * - Session 类型从 next-auth 改为 auth-js
 */

"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useAuthStore } from "@/stores";

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
      setUser({
        id: session.user.id || "",
        email: session.user.email || "",
        name: session.user.name || "",
        image: session.user.image || undefined,
      });
    } else {
      setUser(null);
    }
    setLoading(false);
  }, [session, status, setUser, setLoading]);

  return null;
}

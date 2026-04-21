/**
 * Auth Sync - 同步 Auth.js v5 Session 到 Zustand Store
 *
 * 仅负责基于 session 触发个性化数据加载。
 * 认证状态本身以 NextAuth session 为单一来源，不再镜像到客户端 store。
 */

"use client";

import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { useUserPreferencesStore } from "@/stores/user-preferences";

export function AuthSync() {
  const { data: session, status } = useSession();
  const loadPreferences = useUserPreferencesStore((s) => s.loadPreferences);
  const resetPreferences = useUserPreferencesStore((s) => s.reset);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (session?.user) {
        await loadPreferences().catch((err) => {
          if (!cancelled) console.error("Failed to load user preferences:", err);
        });
        return;
      }

      if (status !== "loading") {
        resetPreferences();
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [session, status, loadPreferences, resetPreferences]);

  return null;
}

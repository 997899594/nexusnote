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
import { useAuthStore, useUserPreferencesStore } from "@/stores";

export function AuthSync() {
  const { data: session, status } = useSession();
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const loadPreferences = useUserPreferencesStore((s) => s.loadPreferences);
  const resetPreferences = useUserPreferencesStore((s) => s.reset);

  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }

    let cancelled = false;

    const load = async () => {
      if (session?.user) {
        setUser({
          id: session.user.id || "",
          email: session.user.email || "",
          name: session.user.name || "",
          image: session.user.image || undefined,
        });
        // Load user preferences (personas, style profile, etc.)
        await loadPreferences().catch((err) => {
          if (!cancelled) console.error("Failed to load user preferences:", err);
        });
      } else {
        setUser(null);
        resetPreferences();
      }
      if (!cancelled) setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [session, status, setUser, setLoading, loadPreferences, resetPreferences]);

  return null;
}

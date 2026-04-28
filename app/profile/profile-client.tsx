"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function ProfileSignOut() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-rose-50 hover:text-rose-600"
    >
      <LogOut className="w-4 h-4" />
      退出登录
    </button>
  );
}

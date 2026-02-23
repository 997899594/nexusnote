"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function ProfileSignOut() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
    >
      <LogOut className="w-4 h-4" />
      退出登录
    </button>
  );
}

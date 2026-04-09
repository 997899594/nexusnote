"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createLoginPath, getCurrentCallbackUrl } from "@/lib/auth-redirect";
import { getProfileAvatarLabel } from "@/lib/profile/avatar";
import type { User } from "@/types";

interface UserAvatarProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ className = "", size = "md" }: UserAvatarProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const sessionUser = session?.user
    ? {
        id: session.user.id || "",
        email: session.user.email || "",
        name: session.user.name || "",
        image: session.user.image || undefined,
      }
    : null;
  const displayUser: User | null = status === "authenticated" ? sessionUser : null;

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-10 h-10 text-base",
    lg: "w-12 h-12 text-lg",
  };

  const sizeMap = {
    sm: 32,
    md: 40,
    lg: 48,
  };

  const handleClick = () => {
    if (status === "loading") return;

    if (status === "authenticated") {
      router.push("/profile");
    } else {
      router.push(createLoginPath(getCurrentCallbackUrl()));
    }
  };

  // Loading state - show pulse
  if (status === "loading") {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-[var(--color-hover)] animate-pulse ${className}`}
      />
    );
  }

  // User has image - show image
  if (displayUser?.image) {
    return (
      <Image
        src={displayUser.image}
        alt={displayUser.name || displayUser.email}
        width={sizeMap[size]}
        height={sizeMap[size]}
        onClick={handleClick}
        className={`${sizeClasses[size]} rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity ${className}`}
        unoptimized
      />
    );
  }

  // Fallback - show initials with accent color background
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${sizeClasses[size]} rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center font-medium border-0 p-0 hover:opacity-80 transition-opacity ${className}`}
    >
      {displayUser ? getProfileAvatarLabel(displayUser.name, displayUser.email) : "?"}
    </button>
  );
}

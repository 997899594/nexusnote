"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useAuthStore } from "@/stores";

interface UserAvatarProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function UserAvatar({ className = "", size = "md" }: UserAvatarProps) {
  const { user, isLoading } = useAuthStore();
  const router = useRouter();
  const { status } = useSession();

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
    if (status === "authenticated") {
      router.push("/profile");
    } else {
      router.push("/login");
    }
  };

  // Generate initials from name or email
  const getInitials = (): string => {
    if (!user) return "?";
    if (user.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email[0].toUpperCase();
  };

  // Loading state - show pulse
  if (isLoading) {
    return (
      <div className={`${sizeClasses[size]} rounded-full bg-zinc-100 animate-pulse ${className}`} />
    );
  }

  // User has image - show image
  if (user?.image) {
    return (
      <Image
        src={user.image}
        alt={user.name || user.email}
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
    <div
      onClick={handleClick}
      className={`${sizeClasses[size]} rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center font-medium cursor-pointer hover:opacity-80 transition-opacity ${className}`}
    >
      {getInitials()}
    </div>
  );
}

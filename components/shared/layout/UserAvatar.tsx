"use client";

import { User } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createLoginPath, getCurrentCallbackUrl } from "@/lib/auth/redirect";
import { getProfileAvatarLabel } from "@/lib/profile/avatar";

interface UserAvatarProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
}

interface AvatarUser {
  id: string;
  email: string;
  name: string;
  image?: string;
}

export function UserAvatar({ className = "", size = "md", interactive = true }: UserAvatarProps) {
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
  const displayUser: AvatarUser | null = status === "authenticated" ? sessionUser : null;
  const avatarLabel = displayUser
    ? getProfileAvatarLabel(displayUser.name, displayUser.email)
    : null;
  const hasUsableImage = Boolean(displayUser?.image && !displayUser.image.includes("dicebear.com"));

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
  const actionLabel = status === "authenticated" ? "打开个人中心" : "登录";

  // Loading state - show pulse
  if (status === "loading") {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-[var(--color-hover)] animate-pulse ${className}`}
      />
    );
  }

  // User has image - show image
  if (hasUsableImage && displayUser?.image) {
    if (!interactive) {
      return (
        <div className={`${sizeClasses[size]} overflow-hidden rounded-full ${className}`}>
          <Image
            src={displayUser.image}
            alt={displayUser.name || displayUser.email}
            width={sizeMap[size]}
            height={sizeMap[size]}
            className="h-full w-full object-cover"
            unoptimized
          />
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={actionLabel}
        className={`${sizeClasses[size]} overflow-hidden rounded-full border-0 p-0 transition-opacity hover:opacity-80 ${className}`}
      >
        <Image
          src={displayUser.image}
          alt={displayUser.name || displayUser.email}
          width={sizeMap[size]}
          height={sizeMap[size]}
          className="h-full w-full object-cover"
          unoptimized
        />
      </button>
    );
  }

  // Fallback - show initials with accent color background
  if (!interactive) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center font-medium ${className}`}
      >
        {avatarLabel ? (
          avatarLabel
        ) : (
          <User
            className={size === "sm" ? "h-4 w-4" : size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]"}
          />
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={actionLabel}
      className={`${sizeClasses[size]} rounded-full bg-[var(--color-accent)] text-[var(--color-accent-fg)] flex items-center justify-center font-medium border-0 p-0 hover:opacity-80 transition-opacity ${className}`}
    >
      {avatarLabel ? (
        avatarLabel
      ) : (
        <User
          className={size === "sm" ? "h-4 w-4" : size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]"}
        />
      )}
    </button>
  );
}

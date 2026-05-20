"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { createLoginPath, getCurrentCallbackUrl } from "@/lib/auth/redirect";
import { cn } from "@/lib/utils";
import { UserAvatar } from "./UserAvatar";

interface FloatingHeaderProps {
  showBackHint?: boolean;
  onLogoClick?: () => void;
  title?: string;
  subtitle?: string;
  variant?: "brand" | "workspace" | "compact";
}

export function FloatingHeader({
  showBackHint = false,
  onLogoClick,
  title,
  subtitle,
  variant = "brand",
}: FloatingHeaderProps) {
  const router = useRouter();
  const { status } = useSession();
  const resolvedTitle =
    title ?? (variant === "brand" ? "开始学习" : variant === "workspace" ? "工作台" : "返回");
  const resolvedSubtitle = subtitle ?? (variant === "brand" ? "NexusNote" : null);
  const handleShellClick = onLogoClick ?? (showBackHint ? () => router.back() : undefined);

  const handleAccountClick = () => {
    if (status === "loading") {
      return;
    }

    if (status === "authenticated") {
      router.push("/profile");
      return;
    }

    router.push(createLoginPath(getCurrentCallbackUrl()));
  };

  const leftShellClassName = cn(
    "ui-floating-surface group flex items-center rounded-full",
    variant === "brand" && "gap-3 px-2.5 py-2 pr-4",
    variant === "workspace" && "gap-3 px-3 py-2.5 pr-4",
    variant === "compact" && "gap-2.5 px-3 py-2.5 pr-4",
  );

  const badgeClassName = cn(
    "ui-primary-button flex items-center justify-center rounded-2xl transition-transform group-hover:rotate-6",
    variant === "brand" && "h-9 w-9 md:h-10 md:w-10",
    variant === "workspace" && "h-10 w-10",
    variant === "compact" && "h-8 w-8 rounded-xl",
  );

  const accountShellClassName = cn(
    "ui-floating-surface group flex items-center rounded-full p-1.5 transition-shadow hover:[box-shadow:var(--shadow-soft-panel-hover)] disabled:pointer-events-none",
  );

  return (
    <header className="ui-floating-header fixed z-50">
      <div className="ui-page-frame flex items-center justify-between gap-4">
        <motion.button
          type="button"
          onClick={handleShellClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(leftShellClassName, !handleShellClick && "cursor-default")}
          aria-label={showBackHint ? "返回上一页" : resolvedTitle}
        >
          <div className={badgeClassName}>
            <Zap
              className={cn(
                "text-white",
                variant === "compact" ? "h-4 w-4" : "h-4 w-4 md:h-5 md:w-5",
              )}
            />
          </div>
          <div className="flex min-w-0 flex-col items-start leading-none">
            {resolvedSubtitle ? (
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--color-text-tertiary)]">
                {resolvedSubtitle}
              </span>
            ) : null}
            <span
              className={cn(
                "font-medium text-[var(--color-text)]",
                resolvedSubtitle ? "mt-1" : "",
                variant === "compact" ? "text-sm" : "text-sm md:text-[15px]",
              )}
            >
              {resolvedTitle}
            </span>
          </div>
          <div className="hidden items-center gap-2 md:flex">
            {showBackHint && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="ui-soft-button flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px]"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>返回</span>
              </motion.div>
            )}
          </div>
        </motion.button>

        <motion.button
          type="button"
          onClick={handleAccountClick}
          whileHover={status === "loading" ? undefined : { scale: 1.02 }}
          whileTap={status === "loading" ? undefined : { scale: 0.98 }}
          className={accountShellClassName}
          aria-label={status === "authenticated" ? "打开个人中心" : "登录"}
          disabled={status === "loading"}
        >
          <UserAvatar interactive={false} size={variant === "compact" ? "sm" : "md"} />
        </motion.button>
      </div>
    </header>
  );
}

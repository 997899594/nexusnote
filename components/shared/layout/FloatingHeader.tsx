"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Menu, Zap } from "lucide-react";
import { useState } from "react";
import { SkinSelector } from "@/components/chat/SkinSelector";
import { cn } from "@/lib/utils";
import { useUserPreferencesStore } from "@/stores/user-preferences";
import { DrawerMenu } from "./DrawerMenu";
import { UserAvatar } from "./UserAvatar";

interface FloatingHeaderProps {
  showBackHint?: boolean;
  showMenuButton?: boolean;
  onLogoClick?: () => void;
  onMenuClick?: () => void;
  showSkinSelector?: boolean;
  title?: string;
  subtitle?: string;
  variant?: "brand" | "workspace" | "compact";
}

export function FloatingHeader({
  showBackHint = false,
  showMenuButton = false,
  onLogoClick,
  onMenuClick,
  showSkinSelector = false,
  title,
  subtitle,
  variant = "brand",
}: FloatingHeaderProps) {
  const availableSkins = useUserPreferencesStore((state) => state.availableSkins);
  const currentSkinSlug = useUserPreferencesStore((state) => state.currentSkinSlug);
  const setCurrentSkin = useUserPreferencesStore((state) => state.setCurrentSkin);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleMenuClick = () => {
    if (onMenuClick) {
      onMenuClick();
      return;
    }

    setDrawerOpen(true);
  };

  const rightControl = showMenuButton ? (
    <motion.button
      key="menu"
      onClick={handleMenuClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/88 text-[var(--color-text-secondary)] shadow-[0_20px_44px_-32px_rgba(15,23,42,0.2)] backdrop-blur-xl transition-colors hover:bg-white"
    >
      <Menu className="h-5 w-5" />
    </motion.button>
  ) : showSkinSelector && availableSkins.length > 0 ? (
    <div
      key="skin-selector"
      className="rounded-full bg-white/88 p-1.5 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.2)] backdrop-blur-xl"
    >
      <SkinSelector
        skins={availableSkins}
        currentSkinSlug={currentSkinSlug}
        onSkinChange={setCurrentSkin}
        variant="dropdown"
      />
    </div>
  ) : (
    <div
      key="avatar"
      className="rounded-full bg-white/88 p-1.5 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.2)] backdrop-blur-xl"
    >
      <UserAvatar />
    </div>
  );

  const resolvedTitle =
    title ?? (variant === "brand" ? "开始学习" : variant === "workspace" ? "工作台" : "返回");
  const resolvedSubtitle = subtitle ?? (variant === "brand" ? "NexusNote" : null);

  const leftShellClassName = cn(
    "group flex items-center rounded-full bg-white/88 backdrop-blur-xl",
    variant === "brand" && "gap-3 px-2.5 py-2 pr-4 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.2)]",
    variant === "workspace" &&
      "gap-3 px-3 py-2.5 pr-4 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.16)]",
    variant === "compact" &&
      "gap-2.5 px-3 py-2.5 pr-4 shadow-[0_16px_36px_-32px_rgba(15,23,42,0.16)]",
  );

  const badgeClassName = cn(
    "flex items-center justify-center rounded-2xl bg-[#111827] text-white transition-transform group-hover:rotate-6",
    variant === "brand" && "h-9 w-9 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.36)] md:h-10 md:w-10",
    variant === "workspace" && "h-10 w-10 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28)]",
    variant === "compact" && "h-8 w-8 rounded-xl shadow-[0_14px_28px_-24px_rgba(15,23,42,0.24)]",
  );

  return (
    <>
      <header className="ui-floating-header fixed z-50">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <motion.button
            onClick={onLogoClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={leftShellClassName}
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
                <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/35">
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
                  className="flex items-center gap-1 rounded-full bg-[#f3f5f8] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>返回首页</span>
                </motion.div>
              )}
            </div>
          </motion.button>

          {rightControl}
        </div>
      </header>
      {showMenuButton && !onMenuClick && (
        <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}

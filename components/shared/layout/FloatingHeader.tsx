"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Menu, Zap } from "lucide-react";
import { useState } from "react";
import { SkinSelector } from "@/components/chat/SkinSelector";
import { useUserPreferencesStore } from "@/stores";
import { DrawerMenu } from "./DrawerMenu";
import { UserAvatar } from "./UserAvatar";

interface FloatingHeaderProps {
  showBackHint?: boolean;
  showMenuButton?: boolean;
  onLogoClick?: () => void;
  onMenuClick?: () => void;
  showSkinSelector?: boolean;
}

export function FloatingHeader({
  showBackHint = false,
  showMenuButton = false,
  onLogoClick,
  onMenuClick,
  showSkinSelector = false,
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

  return (
    <>
      <header className="ui-floating-header fixed z-50">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <motion.button
            onClick={onLogoClick}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group flex items-center gap-3 rounded-full bg-white/88 px-2.5 py-2 pr-4 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.2)] backdrop-blur-xl"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#111827] shadow-[0_18px_36px_-28px_rgba(15,23,42,0.36)] transition-transform group-hover:rotate-6 md:h-10 md:w-10">
              <Zap className="h-4 w-4 text-white md:h-5 md:w-5" />
            </div>
            <div className="flex min-w-0 flex-col items-start leading-none">
              <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/35">
                NexusNote
              </span>
              <span className="mt-1 text-sm font-medium text-[var(--color-text)] md:text-[15px]">
                开始学习
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

          <div className="flex items-center gap-2 rounded-full bg-white/88 p-1.5 pl-2 shadow-[0_20px_44px_-32px_rgba(15,23,42,0.2)] backdrop-blur-xl">
            {showSkinSelector && availableSkins.length > 0 && (
              <SkinSelector
                skins={availableSkins}
                currentSkinSlug={currentSkinSlug}
                onSkinChange={setCurrentSkin}
                variant="dropdown"
              />
            )}
            {showMenuButton && (
              <motion.button
                onClick={handleMenuClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-full bg-[#f3f5f8] p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[#eceff3] lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </motion.button>
            )}
            <UserAvatar />
          </div>
        </div>
      </header>
      {showMenuButton && !onMenuClick && (
        <DrawerMenu isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      )}
    </>
  );
}

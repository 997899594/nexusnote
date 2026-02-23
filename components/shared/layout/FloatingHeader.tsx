"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Menu, Zap } from "lucide-react";
import { UserAvatar } from "./UserAvatar";
import { PersonaSelector } from "@/components/chat/PersonaSelector";
import { useUserPreferencesStore } from "@/stores";

interface FloatingHeaderProps {
  showBackHint?: boolean;
  showMenuButton?: boolean;
  onLogoClick?: () => void;
  onMenuClick?: () => void;
  showPersonaSelector?: boolean;
}

export function FloatingHeader({
  showBackHint = false,
  showMenuButton = false,
  onLogoClick,
  onMenuClick,
  showPersonaSelector = false,
}: FloatingHeaderProps) {
  const availablePersonas = useUserPreferencesStore((state) => state.availablePersonas);
  const currentPersonaSlug = useUserPreferencesStore((state) => state.currentPersonaSlug);
  const setCurrentPersona = useUserPreferencesStore((state) => state.setCurrentPersona);

  return (
    <header className="fixed top-6 left-6 right-6 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <motion.button
          onClick={onLogoClick}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="group flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center transition-transform group-hover:rotate-12">
            <Zap className="w-5 h-5 text-[var(--color-accent-fg)]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg text-zinc-900">NexusNote</span>
            {showBackHint && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 text-xs text-zinc-400"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>返回首页</span>
              </motion.div>
            )}
          </div>
        </motion.button>

        <div className="flex items-center gap-3">
          {showPersonaSelector && availablePersonas.length > 0 && (
            <PersonaSelector
              personas={availablePersonas}
              currentPersonaSlug={currentPersonaSlug}
              onPersonaChange={setCurrentPersona}
              variant="dropdown"
            />
          )}
          {showMenuButton && (
            <motion.button
              onClick={onMenuClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-xl bg-white/80 backdrop-blur-sm shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow lg:hidden"
            >
              <Menu className="w-5 h-5 text-zinc-600" />
            </motion.button>
          )}
          <UserAvatar />
        </div>
      </div>
    </header>
  );
}

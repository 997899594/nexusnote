"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, Settings, User, X, Zap } from "lucide-react";
import { useState } from "react";

export function OrganicHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 md:px-8 md:py-6 max-w-7xl mx-auto w-full flex justify-between items-center pointer-events-none">
        {/* Logo Area */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary-foreground fill-primary-foreground" />
          </div>
          <span className="text-xs font-black uppercase tracking-[0.3em] text-foreground/40">
            NexusNote
          </span>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-3 pointer-events-auto">
          <button className="w-10 h-10 flex items-center justify-center rounded-full text-black/40 hover:bg-white hover:text-black hover:shadow-sm transition-all backdrop-blur-sm">
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-full bg-white border border-black/5 flex items-center justify-center text-black/40 cursor-pointer hover:scale-105 transition-all shadow-sm">
            <User className="w-4 h-4" />
          </div>
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden pointer-events-auto w-10 h-10 bg-white rounded-full shadow-sm border border-black/5 flex items-center justify-center text-black/60 active:scale-95 transition-all"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-[#FDFDFD] pt-24 px-6 md:hidden"
          >
            <nav className="flex flex-col gap-6">
              <MobileNavLink icon={User} label="Profile" />
              <MobileNavLink icon={Settings} label="Settings" />
              <div className="h-[1px] bg-black/5 w-full my-2" />
              <div className="text-xs font-bold text-black/20 uppercase tracking-widest">
                Recent
              </div>
              <div className="flex flex-col gap-4">
                <div className="text-lg font-medium text-black/80">Rust Ownership</div>
                <div className="text-lg font-medium text-black/80">System Design</div>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MobileNavLink({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <button className="flex items-center gap-4 text-2xl font-semibold text-black/80">
      <Icon className="w-6 h-6 text-black/40" />
      {label}
    </button>
  );
}

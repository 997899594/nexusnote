"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

export interface RecentCardProps {
  title: string;
  desc: string;
  icon: LucideIcon;
  time: string;
}

export function RecentCard({ title, desc, icon: Icon, time }: RecentCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-white rounded-2xl p-5 cursor-pointer transition-all duration-200 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)]"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center">
          <Icon className="w-4 h-4 text-zinc-500" />
        </div>
        <span className="text-xs text-zinc-400">{time}</span>
      </div>
      <h3 className="font-medium text-sm text-zinc-900 mb-0.5">{title}</h3>
      <p className="text-xs text-zinc-400">{desc}</p>
    </motion.div>
  );
}

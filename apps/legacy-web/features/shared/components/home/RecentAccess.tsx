"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, Clock, FileText } from "lucide-react";
import { cn } from "@/features/shared/utils";
import type { RecentItemDTO } from "@/lib/actions/types";

interface RecentAccessProps {
  items?: RecentItemDTO[];
  loading?: boolean;
  onItemClick?: (item: RecentItemDTO) => void;
}

export const RecentAccess = ({ items, loading, onItemClick }: RecentAccessProps) => {
  const displayItems = (items || []).slice(0, 3);

  return (
    <div className="w-full">
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
        ) : displayItems.length > 0 ? (
          displayItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <AccessItem item={item} onClick={() => onItemClick?.(item)} />
            </motion.div>
          ))
        ) : (
          <div className="col-span-3 text-center">
            <p className="text-[10px] font-bold text-foreground/20 uppercase tracking-widest">
              暂无最近活动
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const AccessItem = ({ item, onClick }: { item: RecentItemDTO; onClick?: () => void }) => {
  const formatTimeAgo = (isoString: string) => {
    const time = new Date(isoString).getTime();
    const seconds = Math.floor((Date.now() - time) / 1000);
    if (seconds < 60) return "刚刚";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative w-full text-left touch-safe"
    >
      <div className="absolute inset-0 bg-surface rounded-xl transition-all group-hover:shadow-glass" />

      <div className="relative p-4 min-h-[120px] flex flex-col justify-between border border-border/5 rounded-xl bg-surface/50 backdrop-blur-sm transition-all group-hover:border-border/10">
        <div className="flex justify-between items-start gap-2">
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center transition-all shrink-0",
              item.type === "course"
                ? "bg-primary/10 text-primary"
                : "bg-foreground/5 text-foreground/60",
            )}
          >
            {item.type === "course" ? (
              <BookOpen className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
          </div>
          <div
            className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 shrink-0",
              "bg-foreground/5 text-foreground/30 group-hover:bg-primary group-hover:text-primary-foreground",
            )}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-foreground/30" />
            <p className="text-[9px] font-black uppercase tracking-widest text-foreground/30">
              {formatTimeAgo(item.updatedAt)}
            </p>
          </div>
          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
            {item.title}
          </h3>
        </div>
      </div>
    </motion.button>
  );
};

const SkeletonCard = () => (
  <div className="w-full h-[120px] bg-surface rounded-xl border border-border/5 overflow-hidden">
    <div className="p-4 h-full flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="w-9 h-9 rounded-lg bg-foreground/5 skeleton-gradient" />
        <div className="w-7 h-7 rounded-full bg-foreground/5 skeleton-gradient" />
      </div>
      <div className="space-y-1.5">
        <div className="w-16 h-2 rounded-full bg-foreground/5 skeleton-gradient" />
        <div className="w-full h-3 rounded-lg bg-foreground/5 skeleton-gradient" />
        <div className="w-2/3 h-3 rounded-lg bg-foreground/5 skeleton-gradient" />
      </div>
    </div>
  </div>
);

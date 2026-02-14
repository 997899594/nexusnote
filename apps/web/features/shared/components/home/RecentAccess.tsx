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
  const displayItems = items || [];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          最近访问
        </h2>
        <div className="h-px flex-1 bg-border/5 ml-4" />
      </div>

      <div className="relative -mx-4 px-4 py-2 -my-2 overflow-x-auto scrollbar-hide snap-x snap-mandatory md:overflow-visible md:px-0 md:py-0 md:-my-0">
        <div className="flex md:grid md:grid-cols-3 gap-4 md:gap-6 min-w-max md:min-w-0">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : displayItems.length > 0 ? (
            displayItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.6,
                  delay: index * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="snap-center shrink-0 w-[280px] md:w-auto"
              >
                <AccessItem item={item} onClick={() => onItemClick?.(item)} />
              </motion.div>
            ))
          ) : (
            <div className="col-span-3 py-16 text-center w-full">
              <p className="text-sm font-bold text-foreground/20 uppercase tracking-widest">
                暂无最近活动
              </p>
            </div>
          )}
        </div>
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
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative w-full text-left touch-safe"
    >
      <div className="absolute inset-0 bg-surface rounded-2xl transition-all group-hover:shadow-glass" />

      <div className="relative p-5 min-h-[180px] flex flex-col justify-between border border-border/5 rounded-2xl bg-surface/50 backdrop-blur-sm transition-all group-hover:border-border/10">
        <div className="flex justify-between items-start">
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all",
              item.type === "course"
                ? "bg-primary/10 text-primary"
                : "bg-foreground/5 text-foreground/60",
            )}
          >
            {item.type === "course" ? (
              <BookOpen className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300",
              "bg-foreground/5 text-foreground/30 group-hover:bg-primary group-hover:text-primary-foreground",
            )}
          >
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="w-3 h-3 text-foreground/30" />
            <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">
              {formatTimeAgo(item.updatedAt)}
            </p>
          </div>
          <h3 className="text-sm md:text-base font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-tight">
            {item.title}
          </h3>
        </div>
      </div>
    </motion.button>
  );
};

const SkeletonCard = () => (
  <div className="w-[280px] md:w-auto h-[180px] bg-surface rounded-2xl border border-border/5 overflow-hidden">
    <div className="p-5 h-full flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div className="w-11 h-11 rounded-xl bg-foreground/5 skeleton-gradient" />
        <div className="w-8 h-8 rounded-full bg-foreground/5 skeleton-gradient" />
      </div>
      <div className="space-y-2">
        <div className="w-20 h-3 rounded-full bg-foreground/5 skeleton-gradient" />
        <div className="w-full h-4 rounded-lg bg-foreground/5 skeleton-gradient" />
        <div className="w-3/4 h-4 rounded-lg bg-foreground/5 skeleton-gradient" />
      </div>
    </div>
  </div>
);

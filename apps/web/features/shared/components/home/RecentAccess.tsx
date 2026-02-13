"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, BookOpen, FileText } from "lucide-react";
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
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-[10px] font-bold text-black/20 uppercase tracking-[0.2em]">
          Recently Accessed
        </h2>
        <div className="h-[1px] flex-1 bg-black/[0.03] mx-4" />
      </div>

      <div className="relative -mx-6 px-6 py-12 -my-12 overflow-x-auto md:overflow-visible scrollbar-hide">
        <div className="flex md:grid md:grid-cols-3 gap-6 snap-x min-w-max md:min-w-0">
          {loading ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-[300px] md:w-auto h-[200px] bg-black/[0.02] rounded-[32px] animate-pulse"
              />
            ))
          ) : displayItems.length > 0 ? (
            displayItems.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: index * 0.1,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="snap-center w-[300px] md:w-auto"
              >
                <AccessItem item={item} onClick={() => onItemClick?.(item)} />
              </motion.div>
            ))
          ) : (
            <div className="col-span-3 py-12 text-center w-full">
              <p className="text-sm font-bold text-black/10 uppercase tracking-widest">
                No recent activity
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
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -8 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="group relative cursor-pointer"
    >
      <div className="absolute inset-0 bg-black/[0.02] rounded-[32px] transition-colors group-hover:bg-black/[0.04]" />

      <div className="relative p-8 min-h-[200px] flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-black/40 group-hover:text-black transition-colors">
            {item.type === "course" ? (
              <BookOpen className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>
          <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/20 group-hover:bg-black group-hover:text-white transition-all duration-500">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold text-black/20 uppercase tracking-widest mb-2">
            {formatTimeAgo(item.updatedAt)}
          </p>
          <h3 className="text-lg font-bold text-black/80 group-hover:text-black transition-colors line-clamp-2 leading-tight">
            {item.title}
          </h3>
        </div>
      </div>
    </motion.div>
  );
};

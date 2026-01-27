"use client";

import { motion } from "framer-motion";
import { BookOpen, FileText, ArrowUpRight } from "lucide-react";

interface RecentAccessProps {
  items?: {
    id: string;
    title: string;
    type: "course" | "note";
    date: string;
    icon?: React.ReactNode;
    onClick?: () => void;
  }[];
  loading?: boolean;
}

export const RecentAccess = ({ items, loading }: RecentAccessProps) => {
  // Demo items if none provided
  const displayItems = items || [
    {
      id: "1",
      title: "Quantum Mechanics Fundamentals",
      type: "course",
      date: "2 hours ago",
      icon: <BookOpen className="w-5 h-5" />,
    },
    {
      id: "2",
      title: "Neural Networks Architecture",
      type: "note",
      date: "Yesterday",
      icon: <FileText className="w-5 h-5" />,
    },
    {
      id: "3",
      title: "Advanced React Patterns",
      type: "course",
      date: "3 days ago",
      icon: <BookOpen className="w-5 h-5" />,
    },
  ];

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
                <AccessItem {...item} />
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

const AccessItem = ({
  title,
  type,
  date,
  icon,
  onClick,
}: {
  title: string;
  type: string;
  date: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}) => {
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
            {icon ||
              (type === "course" ? (
                <BookOpen className="w-5 h-5" />
              ) : (
                <FileText className="w-5 h-5" />
              ))}
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowUpRight className="w-5 h-5 text-black/20" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-bold text-black/30 uppercase tracking-wider">
              {type}
            </span>
            <span className="w-1 h-1 rounded-full bg-black/10" />
            <span className="text-[9px] font-medium text-black/20">{date}</span>
          </div>
          <h3 className="text-lg font-bold text-black leading-tight tracking-tight">
            {title}
          </h3>
        </div>
      </div>
    </motion.div>
  );
};

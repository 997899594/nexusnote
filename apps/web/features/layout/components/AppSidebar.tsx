/**
 * AppSidebar - Desktop Navigation
 *
 * 简洁的桌面端侧边栏导航
 */

"use client";

import { motion } from "framer-motion";
import { BookOpen, FileText, Home, Layers, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: Home, label: "首页", href: "/" },
  { icon: BookOpen, label: "学习", href: "/learn" },
  { icon: FileText, label: "笔记", href: "/editor" },
  { icon: Layers, label: "资源", href: "/resources" },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen sticky top-0 bg-slate-50/50 border-r border-slate-200/50">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-200/50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white fill-white" />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">NexusNote</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative ${
                  isActive
                    ? "bg-indigo-600 text-white font-medium"
                    : "text-slate-700/70 hover:bg-slate-900/5 hover:text-slate-900"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 w-1 h-6 bg-indigo-400 rounded-r-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <motion.span whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }}>
                  <Icon className="w-5 h-5" />
                </motion.span>
                <span>{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Settings */}
      <div className="p-3 border-t border-slate-200/50">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-700/70 hover:bg-slate-900/5 hover:text-slate-900 transition-all duration-200"
        >
          <Settings className="w-5 h-5" />
          <span>设置</span>
        </Link>
      </div>
    </aside>
  );
}

export default AppSidebar;

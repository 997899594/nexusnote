/**
 * MobileNav - Mobile Navigation
 *
 * 简洁的移动端底部导航
 */

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Home, Menu, PenTool, Plus, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { DrawerMenu } from "./DrawerMenu";

const navItems = [
  { icon: Home, label: "首页", href: "/" },
  { icon: BookOpen, label: "学习", href: "/learn" },
  { icon: Plus, label: "新建", isFloating: true, isAction: true },
  { icon: Search, label: "发现", href: "/explore" },
  { icon: User, label: "我的", href: "/profile" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const createOptions = [
    { label: "新建笔记", icon: PenTool, href: "/editor/new" },
    { label: "AI 对话", icon: Home, href: "/" },
    { label: "闪卡复习", icon: BookOpen, href: "/flashcards" },
    { label: "模拟面试", icon: User, href: "/interview" },
  ];

  return (
    <>
      {/* Spacer */}
      <div className="h-24 md:hidden pointer-events-none" aria-hidden="true" />

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" aria-label="主导航菜单">
        <div className="absolute inset-0 bg-white/85 backdrop-blur-xl border-t border-slate-200/40 shadow-lg" />

        <div className="relative grid grid-cols-5 h-16 px-2 items-end">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            if (item.isFloating) {
              return (
                <div key="floating" className="flex justify-center h-full relative">
                  <div className="absolute -top-6">
                    <motion.button
                      onClick={() => setDrawerOpen(true)}
                      whileHover={{ scale: 1.08, y: -2 }}
                      whileTap={{ scale: 0.92 }}
                      animate={{
                        boxShadow: drawerOpen
                          ? "0 0 0 8px rgba(99, 102, 241, 0.2)"
                          : createOpen
                            ? "0 0 0 8px rgba(99, 102, 241, 0.2)"
                            : "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                      }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 text-white shadow-lg touch-target"
                      aria-label="菜单"
                    >
                      <motion.div
                        animate={{ rotate: drawerOpen ? 0 : createOpen ? 45 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        {drawerOpen ? <Menu className="w-7 h-7" /> : <Icon className="w-7 h-7" />}
                      </motion.div>
                    </motion.button>
                  </div>
                  <span className="self-end pb-2 text-[10px] font-medium text-slate-500/80">
                    {item.label}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href || "/"}
                className={`flex flex-col items-center justify-center h-full gap-1 transition-colors ${
                  isActive ? "text-slate-900" : "text-slate-500"
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Create Menu Modal */}
      <AnimatePresence>
        {createOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setCreateOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed bottom-24 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-2 md:hidden"
            >
              {createOptions.map((option, index) => (
                <motion.div
                  key={option.label}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link
                    href={option.href}
                    onClick={() => setCreateOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <option.icon className="w-5 h-5 text-slate-600" />
                    </div>
                    <span className="font-medium text-slate-700">{option.label}</span>
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Drawer Menu */}
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        // 用户信息将从 session 获取
      />
    </>
  );
}

export default MobileNav;

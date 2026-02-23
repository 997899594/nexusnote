/**
 * DrawerMenu - 移动端侧滑抽屉菜单
 *
 * 功能:
 * - 从左侧滑出
 * - 遮罩层点击关闭
 * - 包含用户信息、导航项、设置入口
 * - 手势滑动关闭
 */

"use client";

import { AnimatePresence, motion, useMotionValue, useTransform } from "framer-motion";
import {
  BookOpen,
  FileText,
  Home,
  Layers,
  LogOut,
  Settings,
  User,
  Zap,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

export interface DrawerMenuProps {
  /** 是否打开 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 用户名 */
  userName?: string;
  /** 用户邮箱 */
  userEmail?: string;
}

const navItems = [
  { icon: Home, label: "首页", href: "/" },
  { icon: BookOpen, label: "学习", href: "/learn" },
  { icon: FileText, label: "笔记", href: "/editor" },
  { icon: Layers, label: "资源", href: "/resources" },
  { icon: User, label: "我的", href: "/profile" },
];

const quickActions = [
  { icon: FileText, label: "新建笔记", href: "/editor/new" },
  { icon: BookOpen, label: "闪卡复习", href: "/flashcards" },
  { icon: User, label: "模拟面试", href: "/interview" },
];

export function DrawerMenu({ isOpen, onClose, userName, userEmail }: DrawerMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const dragX = useMotionValue(0);

  // 处理导航点击
  const handleNavClick = useCallback(
    (href: string) => {
      onClose();
      router.push(href);
    },
    [onClose, router]
  );

  // 处理退出登录
  const handleSignOut = useCallback(() => {
    logout();
    onClose();
    router.push("/login");
  }, [logout, onClose, router]);

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ESC 键关闭
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 遮罩层 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
            aria-hidden="true"
          />

          {/* 抽屉 */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.x < -100) {
                onClose();
              }
            }}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 w-[280px] z-50 bg-white shadow-2xl md:hidden safe-top"
          >
            {/* 用户信息区 */}
            <div className="p-6 border-b border-zinc-100">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                  {userName
                    ?.split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2) || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-zinc-900 truncate">
                    {userName || "学习者"}
                  </div>
                  <div className="text-sm text-zinc-500 truncate">{userEmail}</div>
                </div>
              </div>
            </div>

            {/* 快速操作 */}
            <div className="px-4 py-4 border-b border-zinc-100">
              <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3 px-2">
                快速操作
              </div>
              <div className="space-y-1">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <motion.button
                      key={action.href}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleNavClick(action.href)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm font-medium">{action.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* 主导航 */}
            <nav className="flex-1 px-4 py-4 overflow-y-auto mobile-scroll">
              {navItems.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const Icon = item.icon;

                return (
                  <motion.button
                    key={item.href}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleNavClick(item.href)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-3 rounded-xl mb-1 transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-700 font-medium"
                        : "text-zinc-700 hover:bg-zinc-50"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", isActive ? "text-indigo-600" : "text-zinc-400")} />
                    <span className="text-sm">{item.label}</span>
                  </motion.button>
                );
              })}
            </nav>

            {/* 底部设置和退出 */}
            <div className="p-4 border-t border-zinc-100 safe-bottom">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleNavClick("/settings")}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-zinc-700 hover:bg-zinc-50 transition-colors mb-1"
              >
                <Settings className="w-5 h-5 text-zinc-400" />
                <span className="text-sm">设置</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">退出登录</span>
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default DrawerMenu;

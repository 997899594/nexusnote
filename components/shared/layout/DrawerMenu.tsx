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

import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, FileText, Home, LogOut, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

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
  { icon: BookOpen, label: "课程", href: "/interview" },
  { icon: FileText, label: "笔记", href: "/editor" },
  { icon: User, label: "我的", href: "/profile" },
];

const quickActions = [
  { icon: FileText, label: "我的笔记", href: "/editor" },
  { icon: BookOpen, label: "AI 课程", href: "/interview" },
];

export function DrawerMenu({ isOpen, onClose, userName, userEmail }: DrawerMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const displayName = userName || session?.user?.name || "学习者";
  const displayEmail = userEmail || session?.user?.email || "";
  const avatarLabel = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // 处理导航点击
  const handleNavClick = (href: string) => {
    onClose();
    router.push(href);
  };

  // 处理退出登录
  const handleSignOut = () => {
    onClose();
    void signOut({ callbackUrl: "/login" });
  };

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
            className="ui-scrim-strong fixed inset-0 z-50 backdrop-blur-sm md:hidden"
            aria-hidden="true"
          />

          {/* 抽屉 */}
          <motion.div
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_e, info) => {
              if (info.offset.x < -100) {
                onClose();
              }
            }}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed top-0 left-0 bottom-0 z-50 w-[280px] overflow-hidden bg-[var(--color-surface)] shadow-2xl md:hidden"
          >
            <div className="safe-top safe-bottom flex h-full flex-col">
              {/* 用户信息区 */}
              <div className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent)] text-xl font-bold text-[var(--color-accent-fg)]">
                    {avatarLabel || displayEmail[0]?.toUpperCase() || "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-[var(--color-text)]">
                      {displayName}
                    </div>
                    <div className="truncate text-sm text-[var(--color-text-tertiary)]">
                      {displayEmail}
                    </div>
                  </div>
                </div>
              </div>

              {/* 快速操作 */}
              <div className="px-4 py-4">
                <div className="mb-3 px-2 text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                  快速开始
                </div>
                <div className="space-y-1">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <motion.button
                        key={action.href}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleNavClick(action.href)}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)]"
                      >
                        <Icon className="h-4 w-4 text-[var(--color-text-muted)]" />
                        <span className="text-sm font-medium">{action.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* 主导航 */}
              <nav className="mobile-scroll flex-1 overflow-y-auto px-4 py-4">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <motion.button
                      key={item.href}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleNavClick(item.href)}
                      className={cn(
                        "mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 transition-colors",
                        isActive
                          ? "bg-[var(--color-accent-light)] font-medium text-[var(--color-accent)]"
                          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-5 w-5",
                          isActive
                            ? "text-[var(--color-accent)]"
                            : "text-[var(--color-text-muted)]",
                        )}
                      />
                      <span className="text-sm">{item.label}</span>
                    </motion.button>
                  );
                })}
              </nav>

              {/* 底部退出 */}
              <div className="p-4">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-red-600 transition-colors hover:bg-red-50"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="text-sm font-medium">退出登录</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default DrawerMenu;

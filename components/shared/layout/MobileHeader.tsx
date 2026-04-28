/**
 * MobileHeader - 移动端顶部导航栏
 *
 * 功能:
 * - 返回按钮 (带确认提示，如果表单有未保存内容)
 * - 标题显示
 * - 右侧操作按钮 (菜单、设置等)
 * - 支持安全区域适配
 */

"use client";

import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { ArrowLeft, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export interface MobileHeaderProps {
  /** 标题文字 */
  title?: string;
  /** 是否显示返回按钮 */
  showBack?: boolean;
  /** 返回确认提示 (有未保存内容时) */
  backConfirm?: boolean;
  /** 右侧操作按钮 */
  rightAction?: "menu" | "close" | "custom";
  /** 右侧自定义操作 */
  onRightAction?: () => void;
  /** 右侧自定义文案 */
  rightLabel?: string;
  /** 滚动时隐藏 (true) 或 固定显示 (false) */
  hideOnScroll?: boolean;
  /** 自定义样式类 */
  className?: string;
  /** 背景样式 */
  variant?: "default" | "transparent" | "glass";
}

export function MobileHeader({
  title,
  showBack = false,
  backConfirm = false,
  rightAction,
  onRightAction,
  rightLabel,
  hideOnScroll = false,
  className,
  variant = "default",
}: MobileHeaderProps) {
  const router = useRouter();
  const { scrollY } = useScroll();
  const springY = useSpring(scrollY, { stiffness: 300, damping: 30 });

  const handleBack = () => {
    if (backConfirm) {
      if (confirm("有未保存的内容，确定要离开吗？")) {
        router.back();
      }
    } else {
      router.back();
    }
  };

  const handleRightAction = () => {
    if (onRightAction) {
      onRightAction();
    }
  };

  // 计算隐藏动画
  const y = useTransform(springY, [0, 50, 150], [0, 0, -60]);
  const displayY = hideOnScroll ? y : 0;

  const backgroundStyles =
    variant === "transparent"
      ? "bg-transparent"
      : variant === "glass"
        ? "bg-white/90 backdrop-blur-xl shadow-[var(--shadow-soft-panel)]"
        : "bg-white shadow-[var(--shadow-soft-panel)]";

  return (
    <motion.header
      style={{ y: displayY }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 safe-top md:hidden",
        backgroundStyles,
        className,
      )}
    >
      <div className="flex min-h-[3.75rem] items-center justify-between px-4 py-1">
        {/* 左侧 - 返回按钮 */}
        <div className="w-10 flex items-center">
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleBack}
              className="touch-target mobile-no-tap-highlight -ml-1 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors active:bg-[var(--color-active)]"
              aria-label="返回"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          )}
        </div>

        {/* 中间 - 标题 */}
        <div className="flex-1 text-center">
          {title && (
            <h1 className="text-base font-semibold text-[var(--color-text)] truncate px-4">
              {title}
            </h1>
          )}
        </div>

        {/* 右侧 - 操作按钮 */}
        <div className="w-10 flex items-center justify-end">
          {rightAction === "menu" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleRightAction}
              className="touch-target mobile-no-tap-highlight -mr-1 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors active:bg-[var(--color-active)]"
              aria-label="菜单"
            >
              <Menu className="h-5 w-5" />
            </motion.button>
          )}
          {rightAction === "close" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleRightAction}
              className="touch-target mobile-no-tap-highlight -mr-1 flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors active:bg-[var(--color-active)]"
              aria-label="关闭"
            >
              <X className="h-5 w-5" />
            </motion.button>
          )}
          {rightAction === "custom" && onRightAction && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleRightAction}
              className={cn(
                "touch-target mobile-no-tap-highlight -mr-1 flex h-10 min-w-10 items-center justify-center rounded-xl px-3 text-sm font-medium text-[var(--color-text)] transition-colors active:bg-[var(--color-active)]",
                !rightLabel && "w-10 px-0",
              )}
              aria-label="操作"
            >
              {rightLabel ?? null}
            </motion.button>
          )}
        </div>
      </div>
    </motion.header>
  );
}

export default MobileHeader;

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
import { useCallback, useMemo } from "react";
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
  hideOnScroll = false,
  className,
  variant = "default",
}: MobileHeaderProps) {
  const router = useRouter();
  const { scrollY } = useScroll();
  const springY = useSpring(scrollY, { stiffness: 300, damping: 30 });

  const handleBack = useCallback(() => {
    if (backConfirm) {
      // TODO: 显示确认对话框
      if (confirm("有未保存的内容，确定要离开吗？")) {
        router.back();
      }
    } else {
      router.back();
    }
  }, [backConfirm, router]);

  const handleRightAction = useCallback(() => {
    if (onRightAction) {
      onRightAction();
    }
  }, [onRightAction]);

  // 计算隐藏动画
  const y = useTransform(springY, [0, 50, 150], [0, 0, -60]);
  const displayY = hideOnScroll ? y : 0;

  const backgroundStyles = useMemo(() => {
    switch (variant) {
      case "transparent":
        return "bg-transparent";
      case "glass":
        return "bg-white/80 backdrop-blur-xl border-b border-zinc-200/40";
      default:
        return "bg-white border-b border-zinc-100";
    }
  }, [variant]);

  return (
    <motion.header
      style={{ y: displayY }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 safe-top md:hidden",
        backgroundStyles,
        className,
      )}
    >
      <div className="flex items-center justify-between h-14 px-4">
        {/* 左侧 - 返回按钮 */}
        <div className="w-10 flex items-center">
          {showBack && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleBack}
              className="touch-target mobile-no-tap-highlight flex items-center justify-center w-10 h-10 -ml-2 rounded-full active:bg-zinc-100 transition-colors"
              aria-label="返回"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-700" />
            </motion.button>
          )}
        </div>

        {/* 中间 - 标题 */}
        <div className="flex-1 text-center">
          {title && (
            <h1 className="text-base font-semibold text-zinc-900 truncate px-4">{title}</h1>
          )}
        </div>

        {/* 右侧 - 操作按钮 */}
        <div className="w-10 flex items-center justify-end">
          {rightAction === "menu" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleRightAction}
              className="touch-target mobile-no-tap-highlight flex items-center justify-center w-10 h-10 -mr-2 rounded-full active:bg-zinc-100 transition-colors"
              aria-label="菜单"
            >
              <Menu className="w-5 h-5 text-zinc-700" />
            </motion.button>
          )}
          {rightAction === "close" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleRightAction}
              className="touch-target mobile-no-tap-highlight flex items-center justify-center w-10 h-10 -mr-2 rounded-full active:bg-zinc-100 transition-colors"
              aria-label="关闭"
            >
              <X className="w-5 h-5 text-zinc-700" />
            </motion.button>
          )}
          {rightAction === "custom" && onRightAction && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleRightAction}
              className="touch-target mobile-no-tap-highlight flex items-center justify-center w-10 h-10 -mr-2 rounded-full active:bg-zinc-100 transition-colors"
              aria-label="操作"
            >
              {/* 父组件可传入自定义内容 */}
            </motion.button>
          )}
        </div>
      </div>
    </motion.header>
  );
}

export default MobileHeader;

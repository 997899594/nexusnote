/**
 * ResponsiveContainer - 响应式容器包装器
 *
 * 根据设备类型自动调整:
 * - 移动端: 全宽，小边距
 * - 平板: 限制最大宽度
 * - 桌面: 居中布局
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ResponsiveContainerProps {
  children: ReactNode;
  /** 自定义样式类 */
  className?: string;
  /** 是否在移动端也应用边距 */
  mobilePadding?: boolean;
  /** 最大宽度变体 */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  full: "max-w-full",
};

export function ResponsiveContainer({
  children,
  className,
  mobilePadding = true,
  maxWidth = "full",
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto",
        maxWidthClasses[maxWidth],
        mobilePadding ? "px-4 md:px-6 lg:px-8" : "md:px-6 lg:px-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * MobilePageContainer - 移动端页面容器
 *
 * 自动处理:
 * - 顶部安全区域 (与 MobileHeader 配合)
 * - 底部安全区域 (与 MobileNav 配合)
 * - 内容区域
 */
export interface MobilePageContainerProps {
  children: ReactNode;
  /** 是否有顶部导航栏 */
  hasHeader?: boolean;
  /** 是否有底部导航栏 */
  hasNav?: boolean;
  /** 自定义样式类 */
  className?: string;
}

export function MobilePageContainer({
  children,
  hasHeader = false,
  hasNav = true,
  className,
}: MobilePageContainerProps) {
  const paddingTop = hasHeader ? "pt-14 md:pt-6" : "pt-4 md:pt-6";
  const paddingBottom = hasNav ? "safe-bottom md:pb-6" : "pb-4 md:pb-6";

  return (
    <div className={cn("min-h-screen bg-slate-50", paddingTop, paddingBottom, className)}>
      {/* 移动端底部导航占位 */}
      {hasNav && <div className="mobile-nav-spacer md:hidden" />}
      {children}
    </div>
  );
}

export default ResponsiveContainer;

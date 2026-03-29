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
 * - 移动端底部留白
 * - 内容区域
 */
export interface MobilePageContainerProps {
  children: ReactNode;
  /** 是否有顶部导航栏 */
  hasHeader?: boolean;
  /** 自定义样式类 */
  className?: string;
}

export function MobilePageContainer({
  children,
  hasHeader = false,
  className,
}: MobilePageContainerProps) {
  const paddingTop = hasHeader ? "pt-14 md:pt-6" : "pt-4 md:pt-6";

  return (
    <div className={cn("min-h-screen bg-[var(--color-bg)]", paddingTop, "pb-4 md:pb-6", className)}>
      {children}
    </div>
  );
}

export default ResponsiveContainer;

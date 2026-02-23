# 移动端响应式适配实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 NexusNote 添加完整的移动端响应式适配，支持手机(<640px)、平板(640-1024px)、桌面(>1024px) 三种断点，打造原生 App 级别的移动端体验。

**Architecture:**
- 使用 Tailwind CSS 响应式断点系统，所有改动使用 `sm:`, `md:`, `lg:` 前缀确保 PC 端不受影响
- 新增移动端专用组件：MobileHeader、DrawerMenu、SafeArea、ResponsiveContainer
- 采用移动优先设计原则，渐进增强到桌面端

**Tech Stack:**
- Next.js 16 / React 19
- Tailwind CSS 4.2 (OKLCH 色彩系统)
- Framer Motion (动画)
- TypeScript

**断点定义:**
```css
sm: 640px   /* 手机横屏小平板 */
md: 768px   /* 平板竖屏 */
lg: 1024px  /* 平板横屏小桌面 */
xl: 1280px  /* 桌面 */
```

---

## Phase 1: 基础设施 (Foundation)

### Task 1: 添加移动端安全区域和触摸优化

**Files:**
- Modify: `app/globals.css`

**Step 1: 添加安全区域 CSS 变量和工具类**

在 `app/globals.css` 文件的 `/* Scrollbar */` 部分之前添加：

```css
/* ────────────────────────────────────────────────────────────────────────────
 * Mobile Safe Area & Touch Optimization
 * ──────────────────────────────────────────────────────────────────────────── */

/* 安全区域支持 - 刘海屏/底部指示器 */
@supports (padding: env(safe-area-inset-top)) {
  .safe-top {
    padding-top: env(safe-area-inset-top);
  }
  .safe-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
  .safe-left {
    padding-left: env(safe-area-inset-left);
  }
  .safe-right {
    padding-right: env(safe-area-inset-right);
  }
  .safe-all {
    padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);
  }
}

/* 移动端底部导航安全区域 */
.mobile-nav-spacer {
  height: calc(64px + env(safe-area-inset-bottom, 0px));
}

@media (min-width: 768px) {
  .mobile-nav-spacer {
    display: none;
  }
}

/* 触摸优化 - 确保点击区域足够大 */
@media (hover: none) and (pointer: coarse) {
  .touch-target {
    min-width: 44px;
    min-height: 44px;
    min-touch-action: manipulation;
  }

  /* 移除 hover 延迟 */
  a,
  button {
    touch-action: manipulation;
  }
}

/* 防止移动端双击缩放 */
.mobile-no-tap-highlight {
  -webkit-tap-highlight-color: transparent;
}

/* 移动端滚动优化 */
.mobile-scroll {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

**Step 2: 验证 CSS 加载**

运行: `bun run dev`
打开浏览器 DevTools，检查 Elements 面板中是否有 `.safe-top` 等类
预期: CSS 文件包含新添加的工具类

**Step 3: 提交**

```bash
git add app/globals.css
git commit -m "feat(mobile): add safe area and touch optimization CSS utilities"
```

---

### Task 2: 创建 MobileHeader 组件

**Files:**
- Create: `components/shared/layout/MobileHeader.tsx`
- Create: `components/shared/layout/index.ts`

**Step 1: 创建 MobileHeader 组件**

创建文件 `components/shared/layout/MobileHeader.tsx`:

```tsx
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

import { MotionValue, motion, useScroll, useSpring } from "framer-motion";
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
  const y = useMemo(() => {
    return hideOnScroll
      ? (springY as MotionValue<number>).to([0, 50, 150], [0, 0, -60])
      : 0;
  }, [hideOnScroll, springY]);

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
      style={{ y }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50 safe-top md:hidden",
        backgroundStyles,
        className
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
            <h1 className="text-base font-semibold text-zinc-900 truncate px-4">
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
```

**Step 2: 更新 index.ts 导出**

创建或修改 `components/shared/layout/index.ts`:

```tsx
export { MobileHeader } from "./MobileHeader";
export { MobileNav } from "./MobileNav";
export { AppSidebar } from "./AppSidebar";
export { FloatingHeader } from "./FloatingHeader";
export { UserAvatar } from "./UserAvatar";
```

**Step 3: 验证组件可导入**

运行: `bun run dev`
在浏览器控制台尝试导入: 检查是否有 TypeScript 错误
预期: 无错误，组件可以正常导入

**Step 4: 提交**

```bash
git add components/shared/layout/MobileHeader.tsx components/shared/layout/index.ts
git commit -m "feat(mobile): add MobileHeader component with safe area support"
```

---

### Task 3: 创建 DrawerMenu 抽屉菜单组件

**Files:**
- Create: `components/shared/layout/DrawerMenu.tsx`
- Modify: `components/shared/layout/index.ts`

**Step 1: 创建 DrawerMenu 组件**

创建文件 `components/shared/layout/DrawerMenu.tsx`:

```tsx
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
  Moon,
  Settings,
  Sun,
  User,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores";

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
  const signOut = useAuthStore((state) => state.signOut);

  const dragX = useMotionValue(0);
  const dragProgress = useTransform(dragX, [0, -300], [0, 1]);

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
    signOut();
    onClose();
    router.push("/login");
  }, [signOut, onClose, router]);

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
```

**Step 2: 更新 index.ts 导出**

修改 `components/shared/layout/index.ts`:

```tsx
export { MobileHeader } from "./MobileHeader";
export { MobileNav } from "./MobileNav";
export { AppSidebar } from "./AppSidebar";
export { FloatingHeader } from "./FloatingHeader";
export { UserAvatar } from "./UserAvatar";
export { DrawerMenu } from "./DrawerMenu";
```

**Step 3: 验证组件编译**

运行: `bun run typecheck`
预期: 无 TypeScript 错误

**Step 4: 提交**

```bash
git add components/shared/layout/DrawerMenu.tsx components/shared/layout/index.ts
git commit -m "feat(mobile): add DrawerMenu component with gesture support"
```

---

### Task 4: 创建 ResponsiveContainer 工具组件

**Files:**
- Create: `components/shared/layout/ResponsiveContainer.tsx`
- Modify: `components/shared/layout/index.ts`

**Step 1: 创建 ResponsiveContainer 组件**

创建文件 `components/shared/layout/ResponsiveContainer.tsx`:

```tsx
/**
 * ResponsiveContainer - 响应式容器包装器
 *
 * 根据设备类型自动调整:
 * - 移动端: 全宽，小边距
 * - 平板: 限制最大宽度
 * - 桌面: 居中布局
 */

import { cn } from "@/lib/utils";
import { ReactNode } from "react";

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
        className
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
```

**Step 2: 更新 index.ts 导出**

修改 `components/shared/layout/index.ts`:

```tsx
export { MobileHeader } from "./MobileHeader";
export { MobileNav } from "./MobileNav";
export { AppSidebar } from "./AppSidebar";
export { FloatingHeader } from "./FloatingHeader";
export { UserAvatar } from "./UserAvatar";
export { DrawerMenu } from "./DrawerMenu";
export {
  ResponsiveContainer,
  MobilePageContainer,
} from "./ResponsiveContainer";
```

**Step 3: 验证类型检查**

运行: `bun run typecheck`
预期: 无 TypeScript 错误

**Step 4: 提交**

```bash
git add components/shared/layout/ResponsiveContainer.tsx components/shared/layout/index.ts
git commit -m "feat(mobile): add ResponsiveContainer and MobilePageContainer utilities"
```

---

## Phase 2: 首页适配 (Homepage)

### Task 5: 修改 FloatingHeader 支持响应式

**Files:**
- Modify: `components/shared/layout/FloatingHeader.tsx`

**Step 1: 修改 FloatingHeader 添加响应式样式**

找到 `className="fixed top-6 left-6 right-6 z-50"` 这一行，替换为:

```tsx
<header className="fixed top-4 left-4 right-4 md:top-6 md:left-6 md:right-6 z-50">
```

找到 `max-w-7xl mx-auto` 这个 div，修改为:

```tsx
<div className="w-full flex items-center justify-between gap-4">
```

修改 Logo 部分，在移动端缩小:

```tsx
<motion.button
  onClick={onLogoClick}
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  className="group flex items-center gap-2 md:gap-3"
>
  <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center transition-transform group-hover:rotate-12">
    <Zap className="w-4 h-4 md:w-5 md:h-5 text-[var(--color-accent-fg)]" />
  </div>
  <div className="flex items-center gap-1 md:gap-2">
    <span className="font-semibold text-base md:text-lg text-zinc-900">NexusNote</span>
    {showBackHint && (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden sm:flex items-center gap-1 text-xs text-zinc-400"
      >
        <ArrowLeft className="w-3 h-3" />
        <span>返回首页</span>
      </motion.div>
    )}
  </div>
</motion.button>
```

**Step 2: 验证首页显示**

运行: `bun run dev`
在移动端预览模式下检查顶部导航
预期: 移动端间距更紧凑，PC 端保持原样

**Step 3: 提交**

```bash
git add components/shared/layout/FloatingHeader.tsx
git commit -m "feat(mobile): make FloatingHeader responsive"
```

---

### Task 6: 修改首页 HeroInput 移动端适配

**Files:**
- Modify: `components/home/HeroInput.tsx`

**Step 1: 修改 HeroInput 容器样式**

找到 `className="relative w-full"` 的 div，修改为:

```tsx
<div className="relative w-full md:w-auto">
```

找到输入框外层的 motion.div，修改 className 和内部 p-6:

```tsx
<motion.div
  ref={(node) => {
    cardRef.current = node;
    refs.setReference(node);
  }}
  whileHover={{ scale: showCommands ? 1 : 1.005 }}
  transition={{ duration: 0.2 }}
  className="relative bg-white shadow-[var(--shadow-elevated)] hover:shadow-[var(--shadow-elevated-hover)] transition-shadow rounded-2xl md:rounded-3xl"
>
  <div className="p-4 md:p-6">
```

**Step 2: 修改 textarea 响应式**

找到 textarea，修改 rows 和 className:

```tsx
<textarea
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder={placeholder}
  rows={1}
  className="w-full bg-transparent border-none outline-none text-base md:text-lg text-zinc-800 placeholder:text-zinc-400 resize-none min-h-[44px] md:min-h-[80px] max-h-[120px] md:max-h-[200px] py-2"
/>
```

**Step 3: 修改发送按钮大小**

找到发送按钮 motion.button，修改大小:

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  onClick={handleSubmit}
  disabled={!input.trim()}
  className={cn(
    "w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 touch-target",
    input.trim()
      ? "bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
      : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
  )}
>
  <Send className="w-4 h-4 md:w-5 md:h-5" />
</motion.button>
```

**Step 4: 验证移动端输入体验**

运行: `bun run dev`
在移动端预览模式下测试输入
预期: 输入框在移动端更紧凑，但仍有 44px 最小触摸区域

**Step 5: 提交**

```bash
git add components/home/HeroInput.tsx
git commit -m "feat(mobile): make HeroInput responsive with proper touch targets"
```

---

### Task 7: 修改首页主体布局

**Files:**
- Modify: `app/page.tsx`

**Step 1: 修改首页容器和标题**

找到 `<main className="min-h-screen bg-slate-50">`，修改为:

```tsx
<main className="min-h-screen bg-slate-50 safe-top">
```

找到 `<div className="max-w-4xl mx-auto px-6 pt-28 pb-20">`，修改为:

```tsx
<div className="max-w-4xl mx-auto px-4 md:px-6 pt-20 md:pt-28 pb-16 md:pb-20">
```

找到 header 部分，修改标题响应式:

```tsx
<header className="mb-10 md:mb-14">
  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-zinc-900 mb-2 md:mb-3 tracking-tight">
    你的私人学习顾问
  </h1>
  <p className="text-base md:text-lg text-zinc-500">让 AI 为你规划、记忆、测评</p>
</header>
```

找到 HeroInput 容器，修改:

```tsx
<div className="mb-10 md:mb-14">
  <HeroInput />
</div>
```

**Step 2: 修改 Recent 卡片网格**

找到 RecentSectionServer 部分，确保 grid 响应式:

```tsx
<Suspense fallback={<RecentSkeleton />}>
  <RecentSectionServer />
</Suspense>
```

检查 RecentCard 是否已经有正确的响应式 (应该已经有 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`)

**Step 3: 验证首页完整显示**

运行: `bun run dev`
在移动端、平板、桌面三种尺寸下测试
预期: 所有尺寸下显示正常，无遮挡

**Step 4: 提交**

```bash
git add app/page.tsx
git commit -m "feat(mobile): make homepage layout responsive"
```

---

### Task 8: 修改 RecentCard 移动端触摸优化

**Files:**
- Modify: `components/home/RecentCard.tsx`

**Step 1: 添加触摸优化类**

找到 className 长字符串，添加触摸优化:

```tsx
className="bg-white rounded-2xl p-4 md:p-5 cursor-pointer transition-all duration-200 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] active:scale-[0.98] touch-target"
```

**Step 2: 验证卡片点击体验**

运行: `bun run dev`
在移动端测试卡片点击
预期: 点击时有视觉反馈

**Step 3: 提交**

```bash
git add components/home/RecentCard.tsx
git commit -m "feat(mobile): add touch feedback to RecentCard"
```

---

## Phase 3: 聊天页适配 (Chat)

### Task 9: 修改 ChatPanel 移动端适配

**Files:**
- Modify: `components/chat/ChatPanel.tsx`

**Step 1: 修改消息容器 padding**

找到消息容器 div，修改:

```tsx
<div className="flex-1 overflow-y-auto mobile-scroll px-4 md:px-6 py-4 safe-bottom">
```

**Step 2: 修改消息最大宽度**

找到 `max-w-[var(--message-max-width)]`，添加响应式:

```tsx
<div className="max-w-[calc(100vw-32px)] md:max-w-[var(--message-max-width)] mx-auto space-y-4">
```

**Step 3: 修改输入框区域**

找到输入框外层，修改:

```tsx
<div className="border-t border-zinc-100 bg-white px-4 md:px-6 py-3 md:py-4 safe-bottom">
```

**Step 4: 修改输入框内部**

找到输入框容器，修改:

```tsx
<div className="flex items-end gap-2 md:gap-3 bg-zinc-50 rounded-2xl p-2 md:p-3">
```

**Step 5: 验证聊天界面**

运行: `bun run dev`
在移动端测试聊天输入和消息显示
预期: 输入框不被底部导航遮挡，消息宽度自适应

**Step 6: 提交**

```bash
git add components/chat/ChatPanel.tsx
git commit -m "feat(mobile): make ChatPanel responsive with safe area support"
```

---

### Task 10: 修改聊天页面布局

**Files:**
- Modify: `app/chat/[id]/page.tsx`

**Step 1: 添加移动端页面容器**

修改整个页面返回:

```tsx
return (
  <div className="flex flex-col h-screen safe-top md:h-full">
    <ChatPanel sessionId={sessionId} pendingMessage={pendingMessage} />
  </div>
);
```

**Step 2: 验证聊天页完整体验**

运行: `bun run dev`
在移动端测试完整聊天流程
预期: 页面高度正确，无滚动问题

**Step 3: 提交**

```bash
git add app/chat/[id]/page.tsx
git commit -m "feat(mobile): add safe area to chat page"
```

---

## Phase 4: 编辑器适配 (Editor)

### Task 11: 创建移动端编辑器工具栏

**Files:**
- Create: `components/editor/MobileEditorToolbar.tsx`
- Modify: `components/editor/index.ts` (如果存在)

**Step 1: 创建移动端编辑器工具栏**

创建文件 `components/editor/MobileEditorToolbar.tsx`:

```tsx
/**
 * MobileEditorToolbar - 移动端编辑器底部工具栏
 *
 * 功能:
 * - 固定在底部
 * - 4-5 个核心格式按钮
 * - 滚动显示更多按钮
 * - 支持长按展开更多选项
 */

"use client";

import { motion } from "framer-motion";
import {
  Bold,
  Code,
  Heading1,
  Italic,
  List,
  ListOrdered,
  More,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react";
import { useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";

export interface MobileEditorToolbarProps {
  editor: Editor | null;
  onMoreClick?: () => void;
}

const basicFormatButtons = [
  { icon: Bold, label: "粗体", action: "bold" },
  { icon: Italic, label: "斜体", action: "italic" },
  { icon: Strikethrough, label: "删除线", action: "strike" },
  { icon: Heading1, label: "标题", action: "heading" },
  { icon: List, label: "列表", action: "bulletList" },
];

const moreButtons = [
  { icon: ListOrdered, label: "有序列表", action: "orderedList" },
  { icon: Quote, label: "引用", action: "blockquote" },
  { icon: Code, label: "代码", action: "codeBlock" },
  { icon: Undo, label: "撤销", action: "undo" },
  { icon: Redo, label: "重做", action: "redo" },
];

export function MobileEditorToolbar({ editor, onMoreClick }: MobileEditorToolbarProps) {
  const handleAction = useCallback(
    (action: string) => {
      if (!editor) return;

      switch (action) {
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "strike":
          editor.chain().focus().toggleStrike().run();
          break;
        case "heading":
          editor.chain().focus().toggleHeading({ level: 1 }).run();
          break;
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "codeBlock":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "undo":
          editor.chain().focus().undo().run();
          break;
        case "redo":
          editor.chain().focus().redo().run();
          break;
      }
    },
    [editor]
  );

  const isActive = useCallback(
    (action: string) => {
      if (!editor) return false;
      switch (action) {
        case "bold":
          return editor.isActive("bold");
        case "italic":
          return editor.isActive("italic");
        case "strike":
          return editor.isActive("strike");
        case "heading":
          return editor.isActive("heading");
        case "bulletList":
          return editor.isActive("bulletList");
        case "orderedList":
          return editor.isActive("orderedList");
        case "blockquote":
          return editor.isActive("blockquote");
        case "codeBlock":
          return editor.isActive("codeBlock");
        default:
          return false;
      }
    },
    [editor]
  );

  const basicButtons = useMemo(() => {
    return basicFormatButtons.map((btn) => {
      const Icon = btn.icon;
      const active = isActive(btn.action);

      return (
        <motion.button
          key={btn.action}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleAction(btn.action)}
          className={cn(
            "touch-target flex flex-col items-center justify-center gap-1 p-2 rounded-xl transition-colors min-w-[56px]",
            active
              ? "bg-indigo-100 text-indigo-700"
              : "text-zinc-600 hover:bg-zinc-100"
          )}
          aria-label={btn.label}
        >
          <Icon className="w-5 h-5" />
          <span className="text-[10px] font-medium">{btn.label}</span>
        </motion.button>
      );
    });
  }, [handleAction, isActive]);

  if (!editor) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-zinc-200/40 safe-bottom md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {basicButtons}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onMoreClick}
          className="touch-target flex flex-col items-center justify-center gap-1 p-2 rounded-xl text-zinc-600 hover:bg-zinc-100 min-w-[56px]"
          aria-label="更多"
        >
          <More className="w-5 h-5" />
          <span className="text-[10px] font-medium">更多</span>
        </motion.button>
      </div>
    </div>
  );
}

export interface MobileEditorMoreMenuProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileEditorMoreMenu({ editor, isOpen, onClose }: MobileEditorMoreMenuProps) {
  const handleAction = useCallback(
    (action: string) => {
      if (!editor) return;

      switch (action) {
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "codeBlock":
          editor.chain().focus().toggleCodeBlock().run();
          break;
        case "undo":
          editor.chain().focus().undo().run();
          break;
        case "redo":
          editor.chain().focus().redo().run();
          break;
      }
      onClose();
    },
    [editor, onClose]
  );

  if (!isOpen || !editor) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 z-40 bg-black/20 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 菜单 */}
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        className="fixed bottom-16 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl p-4 md:hidden"
      >
        <div className="grid grid-cols-5 gap-2">
          {moreButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <motion.button
                key={btn.action}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAction(btn.action)}
                className="touch-target flex flex-col items-center justify-center gap-1 p-3 rounded-xl text-zinc-600 hover:bg-zinc-100"
                aria-label={btn.label}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{btn.label}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

export default MobileEditorToolbar;
```

**Step 2: 验证组件编译**

运行: `bun run typecheck`
预期: 无 TypeScript 错误

**Step 3: 提交**

```bash
git add components/editor/MobileEditorToolbar.tsx
git commit -m "feat(mobile): add mobile editor toolbar component"
```

---

### Task 12: 修改编辑器页面全屏模式

**Files:**
- Modify: `app/editor/[id]/page.tsx`

**Step 1: 修改编辑器页面布局**

替换整个文件内容为:

```tsx
"use client";

import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Editor } from "@/components/editor";
import { MobileEditorToolbar, MobileEditorMoreMenu } from "@/components/editor/MobileEditorToolbar";
import { MobileHeader } from "@/components/shared/layout";

export default function EditorPage() {
  const params = useParams();
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [editorInstance, setEditorInstance] = useState<any>(null);

  useEffect(() => {
    const noteId = params.id as string;
    if (noteId) {
      // Mock load - 实际应调用 API
      setTimeout(() => {
        setTitle("我的笔记");
        setContent("<p>欢迎使用 NexusNote 编辑器</p>");
        setLoading(false);
      }, 500);
    }
  }, [params.id]);

  const handleSave = async () => {
    // TODO: 保存到数据库
    console.log("Saving:", { title, content });
    alert("已保存");
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex items-center justify-center min-h-screen"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-3 border-zinc-200 border-t-indigo-600 rounded-full"
        />
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen bg-white md:bg-slate-50">
      {/* 移动端顶部导航 */}
      <MobileHeader
        title={title || "无标题"}
        showBack
        rightAction="custom"
        onRightAction={handleSave}
        className="md:hidden"
      />

      {/* 桌面端布局 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="hidden md:block max-w-3xl mx-auto px-6 py-8"
      >
        <header className="flex justify-between items-center mb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="笔记标题"
            className="text-2xl font-bold bg-transparent border-none outline-none flex-1"
          />
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            保存
          </motion.button>
        </header>
        <Editor content={content} onChange={setContent} placeholder="开始写作..." />
      </motion.div>

      {/* 移动端全屏编辑 */}
      <div className="md:hidden">
        {/* 移动端标题栏 */}
        <div className="px-4 pt-16 pb-2 border-b border-zinc-100">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="无标题"
            className="w-full text-lg font-semibold bg-transparent border-none outline-none"
          />
        </div>

        {/* 编辑区域 */}
        <div className="px-4 py-4 pb-24">
          <Editor
            content={content}
            onChange={setContent}
            placeholder="开始写作..."
            onReady={setEditorInstance}
          />
        </div>

        {/* 移动端工具栏 */}
        {editorInstance && (
          <>
            <MobileEditorToolbar
              editor={editorInstance}
              onMoreClick={() => setShowMoreMenu(true)}
            />
            <MobileEditorMoreMenu
              editor={editorInstance}
              isOpen={showMoreMenu}
              onClose={() => setShowMoreMenu(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: 验证编辑器移动端显示**

运行: `bun run dev`
在移动端测试编辑器
预期: 全屏编辑模式，底部工具栏正常显示

**Step 3: 提交**

```bash
git add app/editor/[id]/page.tsx
git commit -m "feat(mobile): make editor fullscreen on mobile with bottom toolbar"
```

---

### Task 13: 修改 Editor 组件支持 onReady

**Files:**
- Modify: `components/editor/index.ts` (查找 Editor 组件)

**Step 1: 检查 Editor 组件定义**

运行: `grep -r "export.*Editor" components/editor/`

根据实际文件结构修改 Editor 组件，添加 onReady prop。这可能需要先查看具体的 Editor 组件实现。

**Step 2: 提交**

```bash
git add components/editor/
git commit -m "feat(mobile): add onReady prop to Editor component"
```

---

## Phase 5: 个人资料页适配

### Task 14: 修改个人资料页移动端布局

**Files:**
- Modify: `app/profile/page.tsx`

**Step 1: 修改页面容器**

找到 `<main className="min-h-screen bg-slate-50">`，修改为:

```tsx
<main className="min-h-screen bg-slate-50 safe-top">
```

找到 `<div className="max-w-4xl mx-auto px-6 pt-28 pb-20">`，修改为:

```tsx
<div className="max-w-4xl mx-auto px-4 md:px-6 pt-20 md:pt-28 pb-16 md:pb-20">
```

**Step 2: 修改用户信息卡片**

找到用户信息卡片 div，修改 padding 和头像大小:

```tsx
<div className="bg-white rounded-2xl shadow-[var(--shadow-elevated)] p-4 md:p-8">
  <div className="flex items-start gap-4 md:gap-6">
    <div className="w-14 h-14 md:w-20 md:h-20 rounded-2xl bg-[var(--color-accent)] flex items-center justify-center text-[var(--color-accent-fg)] text-xl md:text-2xl font-bold flex-shrink-0">
```

修改用户信息区域:

```tsx
<div className="flex-1 min-w-0">
  <h1 className="text-lg md:text-2xl font-bold text-zinc-900 mb-1 truncate">
    {session.user.name || "学习者"}
  </h1>
  <p className="text-sm md:text-base text-zinc-500 mb-3 md:mb-4 truncate">{session.user.email}</p>
```

**Step 3: 修改统计卡片网格**

找到统计卡片 grid，修改:

```tsx
<div className="grid grid-cols-2 gap-3 md:gap-4 sm:grid-cols-2 md:grid-cols-4">
```

修改卡片内部:

```tsx
<a
  key={card.label}
  href={card.href}
  className="bg-white rounded-xl shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] p-3 md:p-5 transition-shadow cursor-pointer active:scale-[0.98] touch-target"
>
  <div className={`${card.color} w-8 h-8 md:w-10 md:h-10 rounded-lg flex items-center justify-center mb-2 md:mb-3`}>
    <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
  </div>
  <div className="text-lg md:text-2xl font-bold text-zinc-900 mb-0.5 md:mb-1">{card.value}</div>
  <div className="text-xs md:text-sm text-zinc-500">{card.label}</div>
</a>
```

**Step 4: 修改 AI 使用统计**

找到 AI 使用统计 grid:

```tsx
<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
```

修改内部项目:

```tsx
<div className="flex items-center gap-3 md:gap-4">
  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
    <Zap className="w-5 h-5 md:w-6 md:h-6 text-violet-600" />
  </div>
  <div className="min-w-0 flex-1">
    <div className="text-xs md:text-sm text-zinc-500">请求数</div>
    <div className="text-base md:text-xl font-semibold text-zinc-900 truncate">
      {stats.aiUsage.requestCount}
    </div>
  </div>
</div>
```

**Step 5: 验证个人资料页**

运行: `bun run dev`
在移动端测试个人资料页
预期: 所有卡片布局紧凑合理，无横向溢出

**Step 6: 提交**

```bash
git add app/profile/page.tsx
git commit -m "feat(mobile): make profile page responsive"
```

---

## Phase 6: 整合和测试

### Task 15: 整合 MobileNav 和 DrawerMenu

**Files:**
- Modify: `components/shared/layout/MobileNav.tsx`
- Modify: `app/layout.tsx`

**Step 1: 修改 MobileNav 添加菜单触发**

找到 `isAction: true` 的 Plus 按钮，修改:

```tsx
{ icon: Plus, label: "新建", isFloating: true, isAction: true },
```

修改为:

```tsx
{ icon: Plus, label: "新建", isFloating: true, isAction: true, onClick: "openDrawer" },
```

在组件内添加 drawer 状态:

```tsx
export function MobileNav() {
  const pathname = usePathname();
  const [createOpen, setCreateOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
```

修改 Plus 按钮点击:

```tsx
<motion.button
  onClick={() => setDrawerOpen(true)}
```

添加 DrawerMenu 渲染:

```tsx
      {/* Create Menu Modal */}
      <AnimatePresence>
        {/* ... existing create menu ... */}
      </AnimatePresence>

      {/* Drawer Menu */}
      <DrawerMenu
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        // 用户信息将从 auth store 获取
      />
```

**Step 2: 修改 root layout 支持抽屉菜单**

在 `app/layout.tsx` 中，确保正确导入:

```tsx
import { MobileNav } from "@/components/shared/layout";
import { DrawerMenuProvider } from "@/components/shared/layout/DrawerMenu";
```

(如果需要创建 Provider)

**Step 3: 验证导航交互**

运行: `bun run dev`
测试: 点击底部导航中间按钮 → 打开抽屉菜单
预期: 抽屉菜单正常显示和关闭

**Step 4: 提交**

```bash
git add components/shared/layout/MobileNav.tsx app/layout.tsx
git commit -m "feat(mobile): integrate drawer menu with mobile nav"
```

---

### Task 16: 添加全局触摸反馈样式

**Files:**
- Modify: `app/globals.css`

**Step 1: 添加全局触摸反馈**

在 CSS 文件末尾添加:

```css
/* ────────────────────────────────────────────────────────────────────────────
 * Touch Feedback for Mobile
 * ──────────────────────────────────────────────────────────────────────────── */

/* 移动端点击反馈 */
@media (hover: none) and (pointer: coarse) {
  /* 为所有交互元素添加默认点击样式 */
  button,
  a,
  [role="button"],
  .clickable {
    -webkit-tap-highlight-color: rgba(99, 102, 241, 0.2);
  }

  /* 移除移动端 hover 效果 */
  .hover\\:bg-zinc-50:hover {
    background-color: transparent;
  }

  /* 添加 active 状态 */
  button:active,
  a:active,
  [role="button"]:active {
    opacity: 0.7;
  }
}

/* 平滑滚动 */
@media (prefers-reduced-motion: no-preference) {
  html {
    scroll-behavior: smooth;
  }
}

/* 文字选择优化 */
::selection {
  background-color: oklch(67% 0.14 268 / 20%);
  color: oklch(23% 0.09 268);
}
```

**Step 2: 验证触摸反馈**

运行: `bun run dev`
在移动设备或模拟器上测试点击效果

**Step 3: 提交**

```bash
git add app/globals.css
git commit -m "feat(mobile): add global touch feedback styles"
```

---

### Task 17: 添加视口 meta 标签优化

**Files:**
- Modify: `app/layout.tsx`

**Step 1: 检查 metadata**

确认 `app/layout.tsx` 中有正确的 viewport 设置:

```tsx
export const metadata: Metadata = {
  title: "NexusNote - 私人学习助理",
  description: "AI 驱动的个性化学习平台",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
  },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NexusNote",
  },
};
```

**Step 2: 添加 PWA manifest 链接 (可选)**

在 layout.tsx 的 head 部分添加:

```tsx
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icon-192.png" />
```

**Step 3: 提交**

```bash
git add app/layout.tsx
git commit -m "feat(mobile): add viewport and PWA metadata"
```

---

### Task 18: 最终测试和验证

**Files:**
- Create: `tests/mobile/manual-test-checklist.md` (可选)

**Step 1: 创建测试清单**

创建 `tests/mobile/manual-test-checklist.md`:

```markdown
# 移动端适配测试清单

## 断点测试
- [ ] 手机 (<640px): 所有页面显示正常
- [ ] 平板 (640-1024px): 所有页面显示正常
- [ ] 桌面 (>1024px): 保持原样式不变

## 页面测试
### 首页
- [ ] FloatingHeader 间距正确
- [ ] HeroInput 输入框可用，触摸区域足够大
- [ ] RecentCard 点击有反馈
- [ ] 底部导航显示正常

### 聊天页
- [ ] 消息区域不遮挡
- [ ] 输入框固定底部，不被导航遮挡
- [ ] 消息气泡宽度自适应

### 编辑器
- [ ] 全屏编辑模式
- [ ] 底部工具栏显示正常
- [ ] 格式按钮工作正常
- [ ] "更多"菜单展开正常

### 个人资料页
- [ ] 用户信息卡片布局正确
- [ ] 统计卡片无溢出
- [ ] AI 使用统计布局正确

## 交互测试
- [ ] 所有按钮触摸区域 ≥ 44x44px
- [ ] 点击有视觉反馈
- [ ] 滚动流畅
- [ ] 抽屉菜单滑动正常

## 兼容性测试
- [ ] iOS Safari
- [ ] Android Chrome
- [ ] 微信内置浏览器
```

**Step 2: 运行完整测试**

运行: `bun run dev`
按照测试清单逐项验证

**Step 3: 修复发现的问题**

根据测试结果修复任何发现的问题

**Step 4: 最终提交**

```bash
git add .
git commit -m "feat(mobile): complete mobile responsive adaptation"
```

---

## 验收标准

完成所有任务后，应满足:

1. **响应式断点**: 手机、平板、桌面三种断点正常工作
2. **PC 端无影响**: 桌面端保持原有样式和行为
3. **触摸友好**: 所有交互元素触摸区域 ≥ 44x44px
4. **安全区域**: 支持刘海屏和底部指示器
5. **无滚动问题**: 固定元素不遮挡内容
6. **性能流畅**: 动画和滚动保持 60fps

## 后续优化建议

1. 添加手势导航 (左右滑动切换页面)
2. 添加下拉刷新
3. 添加骨架屏加载状态
4. 优化图片加载 (懒加载、响应式图片)
5. 添加离线支持 (Service Worker)

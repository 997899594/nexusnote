"use client";

import { BookOpen as BookIcon, BookOpen, Home, PenTool, Plus, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/features/shared/utils";

export function MobileNav() {
  const pathname = usePathname();
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  const navItems = [
    { icon: Home, label: "首页", href: "/" },
    { icon: BookOpen, label: "学习", href: "/learn" },
    { icon: Plus, label: "新建", isFloating: true, isAction: true },
    { icon: Search, label: "发现", href: "/explore" },
    { icon: User, label: "我的", href: "/profile" },
  ];

  return (
    <>
      {/* 物理占位符：防止内容被遮挡 */}
      <div className="h-24 md:hidden pointer-events-none" aria-hidden="true" />

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" aria-label="主导航菜单">
        <div className="absolute inset-0 bg-surface/85 backdrop-blur-xl border-t border-border/40 shadow-nav pb-safe-bottom" />

        <div
          className="relative grid grid-cols-5 h-16 px-2 pb-safe-bottom items-end"
          role="navigation"
        >
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            if (item.isFloating) {
              return (
                <div key="floating-create" className="flex justify-center h-full relative group">
                  <div className="absolute -top-6">
                    {item.isAction ? (
                      <button
                        onClick={() => setCreateSheetOpen(true)}
                        className="flex items-center justify-center w-14 h-14 rounded-full
                                   bg-foreground text-background shadow-float
                                   transform transition-all duration-300
                                   hover:-translate-y-1 hover:shadow-lg active:scale-95"
                        aria-label="新建"
                      >
                        <Icon className="w-7 h-7" />
                      </button>
                    ) : (
                      <Link
                        href="/create"
                        className="flex items-center justify-center w-14 h-14 rounded-full
                                   bg-foreground text-background shadow-float
                                   transform transition-all duration-300
                                   hover:-translate-y-1 hover:shadow-lg active:scale-95"
                      >
                        <Icon className="w-7 h-7" />
                      </Link>
                    )}
                  </div>
                  <span className="self-end pb-2 text-[10px] font-medium text-muted-foreground/80">
                    {item.label}
                  </span>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href || "/"}
                className="flex flex-col items-center justify-end h-full pb-2 gap-1 group touch-manipulation"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
              >
                <div
                  className={cn(
                    "p-1.5 rounded-2xl transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground group-active:scale-90",
                  )}
                >
                  <Icon className={cn("w-6 h-6 transition-all", isActive && "stroke-[2.5px]")} />
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* 新建内容 Sheet */}
      {createSheetOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-sheet-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/50 cursor-default"
            onClick={() => setCreateSheetOpen(false)}
            aria-label="关闭"
          />
          <div className="relative w-full max-w-lg bg-background rounded-t-3xl p-6 pb-safe-bottom animate-slide-up">
            <h3 id="create-sheet-title" className="text-lg font-bold mb-4 text-foreground">
              新建内容
            </h3>
            <div className="grid grid-cols-2 gap-3" role="list">
              <button
                className="flex flex-col items-center gap-2 p-4 bg-surface-50 rounded-2xl hover:bg-foreground/5 active:scale-95 transition-all touch-comfortable"
                onClick={() => {
                  window.location.href = "/editor/new";
                  setCreateSheetOpen(false);
                }}
                aria-label="新建笔记"
              >
                <PenTool className="w-8 h-8 text-primary" />
                <span className="font-medium text-foreground">笔记</span>
              </button>
              <button
                className="flex flex-col items-center gap-2 p-4 bg-surface-50 rounded-2xl hover:bg-foreground/5 active:scale-95 transition-all touch-comfortable"
                onClick={() => {
                  window.location.href = "/create";
                  setCreateSheetOpen(false);
                }}
                aria-label="新建课程"
              >
                <BookIcon className="w-8 h-8 text-primary" />
                <span className="font-medium text-foreground">课程</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

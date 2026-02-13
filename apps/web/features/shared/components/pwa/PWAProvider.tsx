/**
 * PWA Service Worker 注册组件
 *
 * 2026 架构师标准：
 * - 自动注册 Service Worker
 * - 提供更新提示
 * - 处理离线状态
 */

"use client";

import { useEffect, useState } from "react";

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [swReady, setSwReady] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    // 仅在生产环境注册
    if (process.env.NODE_ENV !== "production") return;

    let swRegistration: ServiceWorkerRegistration | null = null;

    const registerSW = async () => {
      try {
        if ("serviceWorker" in navigator) {
          swRegistration = await navigator.serviceWorker.register("/sw.js", {
            scope: "/",
          });

          console.log("[PWA] Service Worker 注册成功 ✅");

          // 检测更新
          swRegistration.addEventListener("updatefound", () => {
            const newWorker = swRegistration?.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  // 有新版本可用
                  setShowUpdatePrompt(true);
                }
              });
            }
          });

          setSwReady(true);
        }
      } catch (error) {
        console.error("[PWA] Service Worker 注册失败:", error);
      }
    };

    registerSW();

    // 监听在线状态
    const handleOnline = () => console.log("[PWA] 网络已连接");
    const handleOffline = () => console.log("[PWA] 网络已断开，进入离线模式");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleUpdate = () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
        window.location.reload();
      });
    }
  };

  return (
    <>
      {children}

      {/* 更新提示 */}
      {showUpdatePrompt && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom">
          <span className="text-sm">新版本可用</span>
          <button
            onClick={handleUpdate}
            className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-neutral-200 transition-colors"
          >
            立即更新
          </button>
        </div>
      )}

      {/* 离线提示 */}
      {swReady && !navigator.onLine && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-sm">离线模式</span>
        </div>
      )}
    </>
  );
}

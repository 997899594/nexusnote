"use client";

import { SerwistProvider } from "@serwist/turbopack/react";
import { useEffect, useState } from "react";

function UpdatePrompt() {
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const onControllerChange = () => {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg?.waiting) setShowUpdatePrompt(true);
      });
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    // Check on mount too
    navigator.serviceWorker.getRegistration().then((reg) => {
      reg?.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setShowUpdatePrompt(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const handleUpdate = () => {
    navigator.serviceWorker.getRegistration().then((registration) => {
      registration?.waiting?.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    });
  };

  if (!showUpdatePrompt) return null;

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4 animate-in slide-in-from-bottom">
      <span className="text-sm">新版本可用</span>
      <button
        onClick={handleUpdate}
        className="bg-white text-black px-4 py-1.5 rounded-full text-sm font-medium hover:bg-neutral-200 transition-colors"
      >
        立即更新
      </button>
    </div>
  );
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  // 开发环境禁用 SW
  if (process.env.NODE_ENV === "development") {
    return <>{children}</>;
  }

  return (
    <SerwistProvider swUrl="/serwist/sw.js" options={{ scope: "/" }}>
      {children}
      <UpdatePrompt />
    </SerwistProvider>
  );
}

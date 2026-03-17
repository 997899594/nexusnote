"use client";

/**
 * TransitionOverlay - 输入框膨胀为页面的过渡动画
 *
 * 2026 架构：
 * - 用 clip-path: inset() 做展开/收缩（GPU 合成，零 reflow）
 * - 不动画 top/left/width/height（避免 layout thrashing）
 * - 声明式 motion.div，不用命令式 useAnimate（避免 ref timing 问题）
 * - 路由跳转在动画第一帧立刻触发（不等动画，背后加载）
 */

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTransitionStore } from "@/stores";

/**
 * 将 DOMRect 转换为 clip-path: inset() 值
 * inset(top right bottom left) 从四边向内裁切
 */
function rectToClipPath(rect: DOMRect | null): string {
  if (!rect) {
    // Fallback: 屏幕中心的小矩形
    const centerX = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
    const centerY = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
    const width = 600;
    const height = 120;

    return `inset(${centerY - height / 2}px ${centerX + width / 2}px ${centerY + height / 2}px ${centerX - width / 2}px round 24px)`;
  }

  const top = rect.top;
  const right = window.innerWidth - rect.right;
  const bottom = window.innerHeight - rect.bottom;
  const left = rect.left;

  return `inset(${top}px ${right}px ${bottom}px ${left}px round 24px)`;
}

const EXPAND_CLIP = "inset(0% 0% 0% 0% round 0px)"; // 全屏

export function TransitionOverlay() {
  const router = useRouter();
  const { phase, originRect, targetUrl, finish } = useTransitionStore();

  // Track the clip-path we animate FROM (initial) and TO (target) separately
  // so Framer Motion sees a real change on mount.
  const [initialClip, setInitialClip] = useState(EXPAND_CLIP);
  const [targetClip, setTargetClip] = useState(EXPAND_CLIP);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (phase === "expanding" && targetUrl) {
      const fromClip = rectToClipPath(originRect);
      setInitialClip(fromClip);
      setTargetClip(fromClip); // mount at input-box shape first

      // Show overlay, then animate to fullscreen on next frame
      setIsVisible(true);
      requestAnimationFrame(() => {
        setTargetClip(EXPAND_CLIP);
      });

      // Route push in background — page loads behind the overlay
      router.push(targetUrl);
    } else if (phase === "collapsing") {
      setInitialClip(EXPAND_CLIP);
      setTargetClip(EXPAND_CLIP);

      setIsVisible(true);
      requestAnimationFrame(() => {
        setTargetClip(rectToClipPath(originRect));
      });
    } else if (phase === "idle") {
      setIsVisible(false);
    }
  }, [phase, originRect, targetUrl, router]);

  const handleAnimationComplete = () => {
    if (phase === "collapsing") {
      router.push("/");
      finish();
    } else if (phase === "expanding") {
      setTimeout(() => {
        finish();
      }, 50);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={phase} // remount on phase change so `initial` is re-read
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--color-surface)",
            zIndex: 9999,
            willChange: "clip-path, opacity",
          }}
          initial={{ clipPath: initialClip }}
          animate={{ clipPath: targetClip }}
          exit={{ opacity: 0 }}
          transition={{
            clipPath: {
              duration: phase === "expanding" ? 0.35 : 0.3,
              ease: [0.22, 1, 0.36, 1],
            },
            opacity: { duration: 0.15 },
          }}
          onAnimationComplete={handleAnimationComplete}
        />
      )}
    </AnimatePresence>
  );
}

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
  const [isVisible, setIsVisible] = useState(false);
  const [clipPath, setClipPath] = useState(EXPAND_CLIP);

  // phase 变化时：展开动画
  useEffect(() => {
    if (phase === "expanding" && targetUrl) {
      setIsVisible(true);
      setClipPath(rectToClipPath(originRect)); // 初始：输入框形状

      // 立刻触发路由跳转（Chat 页面在 Overlay 背后加载）
      router.push(targetUrl);

      // 下一帧开始动画（React setState 异步，需要 RAF）
      requestAnimationFrame(() => {
        setClipPath(EXPAND_CLIP); // 动画到全屏
      });
    } else if (phase === "collapsing") {
      setIsVisible(true);
      setClipPath(EXPAND_CLIP); // 初始：全屏

      requestAnimationFrame(() => {
        setClipPath(rectToClipPath(originRect)); // 动画到输入框形状
      });
    } else if (phase === "idle") {
      setIsVisible(false);
    }
  }, [phase, originRect, targetUrl, router]);

  const handleAnimationComplete = () => {
    if (phase === "collapsing") {
      router.push("/"); // 收缩完成，返回首页
      finish();
    } else if (phase === "expanding") {
      // 展开完成，等待淡出
      setTimeout(() => {
        finish(); // finish() → phase 变 idle → isVisible 变 false → exit 动画
      }, 50);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--color-surface)", // 和 HeroInput 卡片同色
            zIndex: 9999,
            willChange: "clip-path, opacity",
          }}
          initial={{ clipPath }}
          animate={{ clipPath }}
          exit={{ opacity: 0 }}
          transition={{
            clipPath: {
              duration: phase === "expanding" ? 0.28 : 0.3,
              ease: [0.4, 0, 0.2, 1],
            },
            opacity: { duration: 0.15 },
          }}
          onAnimationComplete={handleAnimationComplete}
        />
      )}
    </AnimatePresence>
  );
}

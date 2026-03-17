"use client";

/**
 * TransitionOverlay - 输入框膨胀为聊天页的过渡动画
 *
 * 架构：
 * - clip-path: inset() 做展开/收缩（GPU 合成，零 reflow）
 * - 展开时显示用户输入的文字（视觉连续性）
 * - 展开完成后等目标页面 markReady() 才退场（不会白屏闪烁）
 * - 最长等待 1.5s 兜底，避免目标页面永远不 ready 导致卡死
 */

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTransitionStore } from "@/stores";

function rectToClipPath(rect: DOMRect | null): string {
  if (!rect) {
    const cx = typeof window !== "undefined" ? window.innerWidth / 2 : 400;
    const cy = typeof window !== "undefined" ? window.innerHeight / 2 : 300;
    return `inset(${cy - 60}px ${cx + 300}px ${cy + 60}px ${cx - 300}px round 24px)`;
  }
  const top = rect.top;
  const right = window.innerWidth - rect.right;
  const bottom = window.innerHeight - rect.bottom;
  const left = rect.left;
  return `inset(${top}px ${right}px ${bottom}px ${left}px round 24px)`;
}

const EXPAND_CLIP = "inset(0% 0% 0% 0% round 0px)";
const SAFETY_TIMEOUT = 1500; // ms — max wait for target page ready

export function TransitionOverlay() {
  const router = useRouter();
  const phase = useTransitionStore((s) => s.phase);
  const originRect = useTransitionStore((s) => s.originRect);
  const targetUrl = useTransitionStore((s) => s.targetUrl);
  const pendingMessage = useTransitionStore((s) => s.pendingMessage);
  const finish = useTransitionStore((s) => s.finish);
  const markReady = useTransitionStore((s) => s.markReady);

  const [initialClip, setInitialClip] = useState(EXPAND_CLIP);
  const [targetClip, setTargetClip] = useState(EXPAND_CLIP);
  const [isVisible, setIsVisible] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (phase === "expanding" && targetUrl) {
      const fromClip = rectToClipPath(originRect);
      setInitialClip(fromClip);
      setTargetClip(fromClip);
      setShowMessage(true);
      setIsVisible(true);

      requestAnimationFrame(() => {
        setTargetClip(EXPAND_CLIP);
      });

      router.push(targetUrl);
    } else if (phase === "collapsing") {
      setInitialClip(EXPAND_CLIP);
      setTargetClip(EXPAND_CLIP);
      setShowMessage(false);
      setIsVisible(true);

      requestAnimationFrame(() => {
        setTargetClip(rectToClipPath(originRect));
      });
    } else if (phase === "idle") {
      setIsVisible(false);
      setShowMessage(false);
      if (safetyTimer.current) clearTimeout(safetyTimer.current);
    }
  }, [phase, originRect, targetUrl, router]);

  const handleAnimationComplete = () => {
    if (phase === "collapsing") {
      router.push("/");
      finish();
    } else if (phase === "expanding") {
      // Expand animation done — transition to "expanded" (waiting for page ready)
      useTransitionStore.setState({ phase: "expanded" });

      // Safety timeout: if target page never calls markReady, force exit
      safetyTimer.current = setTimeout(() => {
        markReady();
      }, SAFETY_TIMEOUT);
    }
  };

  // Compute the message position: centered in the overlay once expanded
  const messageStyle = originRect
    ? {
        left: originRect.left + 40,
        top: originRect.top + 40,
        maxWidth: originRect.width - 80,
      }
    : { left: 40, top: "40%", maxWidth: 600 };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key={phase === "collapsing" ? "collapse" : "expand"}
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
              duration: phase === "expanding" ? 0.38 : 0.3,
              ease: [0.22, 1, 0.36, 1],
            },
            opacity: { duration: 0.2 },
          }}
          onAnimationComplete={handleAnimationComplete}
        >
          {/* Show user's message during expand for visual continuity */}
          <AnimatePresence>
            {showMessage && pendingMessage && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15, delay: 0.1 }}
                style={{
                  position: "absolute",
                  ...messageStyle,
                  fontSize: "1.125rem",
                  color: "var(--color-text)",
                  pointerEvents: "none",
                }}
              >
                {pendingMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

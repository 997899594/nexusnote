"use client";

import { useEffect, useState } from "react";
import {
  type AnchoredTextItem,
  getTextAnchorHighlights,
  type TextAnchorHighlight,
} from "@/lib/learning/text-anchors";

interface TextAnchorContainerRef {
  current: HTMLElement | null;
}

interface UseTextAnchorHighlightsOptions {
  containerRef: TextAnchorContainerRef;
  items: AnchoredTextItem[];
  enabled?: boolean;
}

const HIGHLIGHT_REFRESH_DELAYS_MS = [250, 750, 1500, 3000];

export function useTextAnchorHighlights({
  containerRef,
  items,
  enabled = true,
}: UseTextAnchorHighlightsOptions): TextAnchorHighlight[] {
  const [highlights, setHighlights] = useState<TextAnchorHighlight[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!enabled || !container || items.length === 0) {
      setHighlights([]);
      return;
    }

    const updateHighlights = () => {
      setHighlights(getTextAnchorHighlights(container, items));
    };

    updateHighlights();

    let secondFrameId: number | null = null;
    const firstFrameId = requestAnimationFrame(() => {
      secondFrameId = requestAnimationFrame(updateHighlights);
    });

    const resizeObserver = new ResizeObserver(updateHighlights);
    resizeObserver.observe(container);

    const mutationObserver = new MutationObserver(updateHighlights);
    mutationObserver.observe(container, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    const timeoutIds = HIGHLIGHT_REFRESH_DELAYS_MS.map((delay) =>
      window.setTimeout(updateHighlights, delay),
    );

    window.addEventListener("resize", updateHighlights);

    return () => {
      cancelAnimationFrame(firstFrameId);
      if (secondFrameId !== null) {
        cancelAnimationFrame(secondFrameId);
      }
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      for (const timeoutId of timeoutIds) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("resize", updateHighlights);
    };
  }, [containerRef, enabled, items]);

  return highlights;
}

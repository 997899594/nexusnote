"use client";

import { Copy, Globe2, Loader2, RotateCcw, Share2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

interface CoursePublishControlProps {
  courseId: string;
}

type PublishState = "idle" | "publishing" | "published" | "revoking" | "error";

export function CoursePublishControl({ courseId }: CoursePublishControlProps) {
  const { addToast } = useToast();
  const [state, setState] = useState<PublishState>("idle");
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadPublication = async () => {
      try {
        const response = await fetch(`/api/courses/${courseId}/publication`);
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          published?: boolean;
          url?: string | null;
        };

        if (!active || !payload.published || !payload.url) {
          return;
        }

        setUrl(payload.url);
        setState("published");
      } catch {
        // Publishing remains available even if the status lookup fails.
      }
    };

    void loadPublication();

    return () => {
      active = false;
    };
  }, [courseId]);

  const publish = async () => {
    setState("publishing");

    try {
      const response = await fetch(`/api/courses/${courseId}/publication`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to publish course.");
      }

      const payload = (await response.json()) as { url?: string };
      if (!payload.url) {
        throw new Error("Missing publication URL.");
      }

      setUrl(payload.url);
      setState("published");
      await navigator.clipboard.writeText(payload.url);
      addToast("公开链接已生成并复制", "success");
    } catch {
      setState("error");
      addToast("发布失败，请稍后重试", "error");
    }
  };

  const copy = async () => {
    if (!url) {
      return;
    }

    await navigator.clipboard.writeText(url);
    addToast("已复制公开链接", "success");
  };

  const revoke = async () => {
    setState("revoking");

    try {
      const response = await fetch(`/api/courses/${courseId}/publication`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke publication.");
      }

      setUrl(null);
      setState("idle");
      addToast("公开链接已关闭", "success");
    } catch {
      setState("published");
      addToast("关闭失败，请稍后重试", "error");
    }
  };

  if ((state === "published" || state === "revoking") && url) {
    const isRevoking = state === "revoking";

    return (
      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="hidden max-w-[14rem] truncate rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] xl:block"
        >
          {url}
        </a>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-xl border border-black/8 bg-white p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          aria-label="复制公开链接"
        >
          <Copy className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void revoke()}
          disabled={isRevoking}
          className="rounded-xl border border-black/8 bg-white p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="关闭公开链接"
        >
          {isRevoking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void publish()}
      disabled={state === "publishing"}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-60",
        state === "error" && "text-[var(--color-text)]",
      )}
    >
      {state === "publishing" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "error" ? (
        <RotateCcw className="h-3.5 w-3.5" />
      ) : (
        <Share2 className="h-3.5 w-3.5" />
      )}
      <span className="hidden lg:inline">{state === "error" ? "重试发布" : "发布"}</span>
      <Globe2 className="h-3.5 w-3.5 lg:hidden" />
    </button>
  );
}

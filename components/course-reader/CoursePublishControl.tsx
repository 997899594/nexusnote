"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/utils/clipboard";

interface CoursePublishControlProps {
  courseId: string;
}

type PublishState = "idle" | "publishing" | "published" | "revoking" | "error";

function buildShareUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, window.location.origin).toString();
}

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
          path?: string | null;
          url?: string | null;
        };

        const publicPath = payload.path ?? payload.url;
        if (!active || !payload.published || !publicPath) {
          return;
        }

        setUrl(buildShareUrl(publicPath));
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

      const payload = (await response.json()) as { path?: string; url?: string };
      const publicPath = payload.path ?? payload.url;
      if (!publicPath) {
        throw new Error("Missing publication path.");
      }
      const shareUrl = buildShareUrl(publicPath);

      setUrl(shareUrl);
      setState("published");
      const copyResult = await copyTextToClipboard(shareUrl);
      if (copyResult === "failed") {
        addToast("公开链接已生成。浏览器限制了复制，可点“复制”重试。", "warning");
        return;
      }

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

    const copyResult = await copyTextToClipboard(url);
    if (copyResult === "failed") {
      addToast("复制受浏览器限制，请从公开页地址栏复制链接", "warning");
      return;
    }

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
          className="rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
        >
          已公开
        </a>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          aria-label="复制公开链接"
        >
          复制
        </button>
        <button
          type="button"
          onClick={() => void revoke()}
          disabled={isRevoking}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="关闭公开链接"
        >
          {isRevoking ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              关闭中
            </>
          ) : (
            "关闭"
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
      {state === "publishing" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      <span>{state === "publishing" ? "发布中" : state === "error" ? "重试发布" : "发布"}</span>
    </button>
  );
}

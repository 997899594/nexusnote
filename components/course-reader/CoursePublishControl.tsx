"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { copyTextToClipboard } from "@/lib/utils/clipboard";

interface CoursePublishControlProps {
  courseId: string;
  variant?: "inline" | "panel";
}

type PublishState = "idle" | "publishing" | "published" | "revoking" | "error";
type PublicationEngagement = {
  likesCount: number;
  urgesCount: number;
};

const emptyEngagement: PublicationEngagement = {
  likesCount: 0,
  urgesCount: 0,
};

function buildShareUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, window.location.origin).toString();
}

function formatEngagement(engagement: PublicationEngagement) {
  const parts = [
    engagement.likesCount > 0 ? `${engagement.likesCount} 赞` : null,
    engagement.urgesCount > 0 ? `${engagement.urgesCount} 催更` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(" · ") : "暂无反馈";
}

export function CoursePublishControl({ courseId, variant = "inline" }: CoursePublishControlProps) {
  const { addToast } = useToast();
  const [state, setState] = useState<PublishState>("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [engagement, setEngagement] = useState<PublicationEngagement>(emptyEngagement);

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
          engagement?: PublicationEngagement;
        };

        if (active && payload.engagement) {
          setEngagement(payload.engagement);
        }

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

      const payload = (await response.json()) as {
        path?: string;
        url?: string;
        engagement?: PublicationEngagement;
      };
      const publicPath = payload.path ?? payload.url;
      if (!publicPath) {
        throw new Error("Missing publication path.");
      }
      const shareUrl = buildShareUrl(publicPath);

      setUrl(shareUrl);
      setEngagement(payload.engagement ?? emptyEngagement);
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
      setEngagement(emptyEngagement);
      setState("idle");
      addToast("公开链接已关闭", "success");
    } catch {
      setState("published");
      addToast("关闭失败，请稍后重试", "error");
    }
  };

  if ((state === "published" || state === "revoking") && url) {
    const isRevoking = state === "revoking";

    if (variant === "panel") {
      return (
        <div className="rounded-2xl border border-black/[0.06] bg-white/70 p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--color-text)]">已公开</div>
              <div className="mt-1 text-xs text-[var(--color-text-tertiary)]">
                {formatEngagement(engagement)}
              </div>
            </div>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
            >
              查看
            </a>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
            >
              复制链接
            </button>
            <button
              type="button"
              onClick={() => void revoke()}
              disabled={isRevoking}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRevoking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {isRevoking ? "关闭中" : "关闭公开"}
            </button>
          </div>
        </div>
      );
    }

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
        {engagement.likesCount > 0 || engagement.urgesCount > 0 ? (
          <span className="rounded-xl border border-black/8 bg-white px-3 py-2 text-xs font-medium text-[var(--color-text-tertiary)]">
            {formatEngagement(engagement)}
          </span>
        ) : null}
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

  if (variant === "panel") {
    return (
      <button
        type="button"
        onClick={() => void publish()}
        disabled={state === "publishing"}
        className={cn(
          "flex w-full items-center justify-between rounded-2xl border border-black/[0.06] bg-white/70 px-3 py-3 text-left transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-60",
          state === "error" && "text-[var(--color-text)]",
        )}
      >
        <span>
          <span className="block text-sm font-semibold text-[var(--color-text)]">
            {state === "publishing" ? "发布中" : state === "error" ? "重试发布" : "公开课程"}
          </span>
          <span className="mt-0.5 block text-xs text-[var(--color-text-tertiary)]">
            生成公开链接
          </span>
        </span>
        {state === "publishing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      </button>
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

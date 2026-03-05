"use client";

import { useEffect } from "react";
import { OutlinePanel } from "./OutlinePanel";
import { useInterviewStore } from "@/stores/interview";

interface OutlineBuilderProps {
  courseId: string | null;
}

export function OutlineBuilder({ courseId }: OutlineBuilderProps) {
  const { outline, isOutlineLoading, setOutline, setIsOutlineLoading, interviewCompleted } = useInterviewStore();

  // 当访谈完成后，自动加载大纲
  useEffect(() => {
    if (!interviewCompleted || !courseId) return;

    async function generateOutline() {
      try {
        setIsOutlineLoading(true);
        const response = await fetch("/api/course/generate-outline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courseId }),
        });

        if (!response.ok) {
          throw new Error("生成大纲失败");
        }

        const data = await response.json();
        setOutline(data);
      } catch (error) {
        console.error("[OutlineBuilder] Failed to load outline:", error);
        setOutline(null);
      } finally {
        setIsOutlineLoading(false);
      }
    }

    generateOutline();
  }, [interviewCompleted, courseId, setOutline, setIsOutlineLoading]);

  return <OutlinePanel outline={outline} isLoading={isOutlineLoading} courseId={courseId ?? undefined} />;
}

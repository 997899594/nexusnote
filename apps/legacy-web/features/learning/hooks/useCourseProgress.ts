"use client";

import { useEffect, useState } from "react";

export interface CourseProgress {
  current: number;
  total: number;
  status: "generating" | "completed" | "failed" | "not_found";
  chapterTitle?: string;
}

export function useCourseProgress(courseId: string | null) {
  const [progress, setProgress] = useState<CourseProgress | null>(null);

  useEffect(() => {
    if (!courseId) return;

    const eventSource = new EventSource(`/api/course/${courseId}/progress`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.status === "not_found") {
          setProgress(null);
          eventSource.close();
          return;
        }

        if (data.progress) {
          setProgress(data.progress as CourseProgress);
        }

        if (data.status === "completed" || data.status === "failed") {
          setProgress((prev) => (prev ? { ...prev, status: data.status } : null));
          eventSource.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => eventSource.close();
  }, [courseId]);

  return progress;
}

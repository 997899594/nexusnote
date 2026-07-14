"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import type { InterviewOutline } from "@/lib/ai/interview/schemas";
import { isUnauthorizedError, parseApiError, redirectToLogin } from "@/lib/api/client";

interface StartCourseFromOutlineParams {
  outline: InterviewOutline | null;
  courseId?: string | null;
}

export function useStartCourseFromOutline({ outline, courseId }: StartCourseFromOutlineParams) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isStarting, setIsStarting] = useState(false);
  const [startStatus, setStartStatus] = useState<string | null>(null);
  const [entitlementRequired, setEntitlementRequired] = useState(false);
  const canStartLearning = Boolean(outline) && !isStarting;

  const startCourse = async () => {
    if (isStarting) {
      return;
    }

    if (!outline) {
      addToast("课程蓝图还没准备好", "error");
      return;
    }

    setIsStarting(true);
    setStartStatus("创建课程");
    setEntitlementRequired(false);

    let isNavigating = false;
    try {
      const response = await fetch("/api/interview/create-course", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          outline,
          courseId,
        }),
      });

      if (!response.ok) {
        throw response;
      }

      const data = (await response.json()) as { courseId?: string };
      if (!data.courseId) {
        throw new Error("课程已创建，但没有返回课程 ID");
      }

      setStartStatus("进入学习页");
      isNavigating = true;
      router.replace(`/learn/${data.courseId}`);
    } catch (error) {
      const { message, status, code } = await parseApiError(error);
      if (isUnauthorizedError(status, code)) {
        redirectToLogin();
        return;
      }

      if (status === 402 && code === "ENTITLEMENT_REQUIRED") {
        setStartStatus(null);
        setEntitlementRequired(true);
        addToast("当前页面中的课程蓝图已保留", "info");
        return;
      }

      setStartStatus(null);
      addToast(message || "课程生成失败", "error");
    } finally {
      if (!isNavigating) {
        setIsStarting(false);
      }
    }
  };

  return {
    canStartLearning,
    isStarting,
    startStatus,
    entitlementRequired,
    clearEntitlementRequired: () => setEntitlementRequired(false),
    startCourse,
  };
}

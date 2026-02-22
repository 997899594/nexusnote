"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface CourseProgress {
  courseId: string;
  title: string;
  status: string;
  progress: string;
  isCompleted: boolean;
}

export default function CoursePage() {
  const params = useParams();
  const router = useRouter();
  const [course, setCourse] = useState<CourseProgress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const courseId = params.id as string;
    if (!courseId) {
      router.push("/");
      return;
    }

    // Mock data - 实际应调用 API
    setTimeout(() => {
      setCourse({
        courseId,
        title: "我的课程",
        status: "generating",
        progress: "3/8",
        isCompleted: false,
      });
      setLoading(false);
    }, 500);
  }, [params.id, router]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 48,
              height: 48,
              border: "3px solid #eee",
              borderTopColor: "#0070f3",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ marginTop: 16, color: "#666" }}>加载中...</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <p>课程不存在</p>
      </div>
    );
  }

  const progressPercent = course.isCompleted
    ? 100
    : Math.round(
        (parseInt(course.progress.split("/")[0], 10) / parseInt(course.progress.split("/")[1], 10)) * 100,
      );

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <header style={{ padding: "20px 0", borderBottom: "1px solid #eee", marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: "bold" }}>{course.title}</h1>
        <p style={{ color: "#666", marginTop: 8 }}>课程进度</p>
      </header>

      <div style={{ background: "#f5f5f5", borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span>{course.status === "completed" ? "已完成" : "生成中"}</span>
          <span>{course.progress}</span>
        </div>
        <div style={{ height: 8, background: "#ddd", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: "#0070f3",
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      {course.isCompleted ? (
        <div style={{ textAlign: "center" }}>
          <button
            style={{
              padding: "14px 32px",
              background: "#0070f3",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            开始学习
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center", color: "#666" }}>
          <p>课程正在生成中，请稍候...</p>
        </div>
      )}
    </div>
  );
}

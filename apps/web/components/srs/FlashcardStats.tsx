"use client";

import { useCallback, useEffect, useState } from "react";
import { flashcardStore, type ReviewStats } from "@/lib/storage/flashcard-store";

interface FlashcardStatsProps {
  onStartReview?: () => void;
}

export function FlashcardStats({ onStartReview }: FlashcardStatsProps) {
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([flashcardStore.getStats(), flashcardStore.getStreak()]);
      setStats(s);
      setStreak(st);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded-lg" />
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-gray-200 rounded-lg" />
          <div className="h-20 bg-gray-200 rounded-lg" />
          <div className="h-20 bg-gray-200 rounded-lg" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* 今日复习卡 */}
      <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl p-6 text-white">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-medium opacity-90">今日待复习</h3>
            <p className="text-4xl font-bold mt-2">{stats.dueToday}</p>
            <p className="text-sm opacity-75 mt-1">张卡片</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1">
              <span className="text-2xl">🔥</span>
              <span className="text-2xl font-bold">{streak}</span>
            </div>
            <p className="text-sm opacity-75">连续天数</p>
          </div>
        </div>

        {stats.dueToday > 0 && onStartReview && (
          <button
            onClick={onStartReview}
            className="mt-4 w-full bg-white/20 hover:bg-white/30 rounded-lg py-3 font-medium transition"
          >
            开始复习
          </button>
        )}
      </div>

      {/* 统计数据 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.newCards}</div>
          <div className="text-sm text-gray-500 mt-1">新卡片</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.learningCards}</div>
          <div className="text-sm text-gray-500 mt-1">学习中</div>
        </div>
        <div className="bg-white border rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.reviewCards}</div>
          <div className="text-sm text-gray-500 mt-1">已掌握</div>
        </div>
      </div>

      {/* 记忆保持率 */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-500">平均记忆保持率</span>
          <span className="font-medium">{stats.averageRetention}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              stats.averageRetention >= 90
                ? "bg-green-500"
                : stats.averageRetention >= 70
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${stats.averageRetention}%` }}
          />
        </div>
      </div>

      {/* 总卡片数 */}
      <div className="text-center text-sm text-gray-500">共 {stats.totalCards} 张卡片</div>
    </div>
  );
}

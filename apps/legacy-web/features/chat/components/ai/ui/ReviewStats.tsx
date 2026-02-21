"use client";

import { Brain, Flame, Target, Trophy } from "lucide-react";
import Link from "next/link";

interface ReviewStatsProps {
  totalCards: number;
  dueToday: number;
  newCards: number;
  learningCards: number;
  masteredCards: number;
  retention: number;
  streak: number;
}

export function ReviewStats({
  totalCards,
  dueToday,
  newCards,
  learningCards,
  masteredCards,
  retention,
  streak,
}: ReviewStatsProps) {
  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 my-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-emerald-600" />
          <span className="font-medium text-gray-900">学习统计</span>
        </div>
        <div className="flex items-center gap-1 text-orange-500">
          <Flame className="w-4 h-4" />
          <span className="font-bold">{streak}</span>
          <span className="text-sm text-gray-500">天</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-lg p-3 border border-emerald-100">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Target className="w-3.5 h-3.5" />
            <span className="text-xs">今日待复习</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{dueToday}</div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-emerald-100">
          <div className="flex items-center gap-2 text-gray-500 mb-1">
            <Trophy className="w-3.5 h-3.5" />
            <span className="text-xs">记忆保持率</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">{retention}%</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-sm mb-4">
        <div className="bg-white rounded-lg p-2 border border-emerald-100">
          <div className="text-blue-600 font-bold">{newCards}</div>
          <div className="text-xs text-gray-500">新卡片</div>
        </div>
        <div className="bg-white rounded-lg p-2 border border-emerald-100">
          <div className="text-yellow-600 font-bold">{learningCards}</div>
          <div className="text-xs text-gray-500">学习中</div>
        </div>
        <div className="bg-white rounded-lg p-2 border border-emerald-100">
          <div className="text-green-600 font-bold">{masteredCards}</div>
          <div className="text-xs text-gray-500">已掌握</div>
        </div>
      </div>

      {dueToday > 0 && (
        <Link
          href="/review"
          className="flex items-center justify-center gap-2 w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition text-sm font-medium"
        >
          开始今日复习
        </Link>
      )}

      {dueToday === 0 && (
        <div className="text-center text-sm text-gray-500 py-2">今日复习已完成，继续保持！</div>
      )}
    </div>
  );
}
